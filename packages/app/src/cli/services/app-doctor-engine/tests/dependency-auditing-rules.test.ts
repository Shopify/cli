import {scanDependencyAuditing} from '../rules/dependency-auditing-rules.js'
import {describe, expect, test} from 'vitest'
import type {ManifestFile, SourceFile} from '../rules/types.js'

const manifest = (path = 'package.json', scripts?: Record<string, string>): ManifestFile => ({
  path,
  absolutePath: `/${path}`,
  type: 'npm',
  dependencies: {react: '19.0.0'},
  scripts,
})

const configuration = (path: string, content: string): SourceFile => ({
  path,
  absolutePath: `/${path}`,
  ext: path.endsWith('.yaml') ? '.yaml' : '.yml',
  content,
})

const github = (body: string): SourceFile =>
  configuration(
    '.github/workflows/ci.yml',
    `on: push
jobs:
  check:
    runs-on: ubuntu-latest
${body}`,
  )

const gitlab = (content: string): SourceFile => configuration('.gitlab-ci.yml', content)
const circle = (content: string): SourceFile => configuration('.circleci/config.yml', content)

function scan(files: SourceFile[], manifests: ManifestFile[] = [manifest()]) {
  return scanDependencyAuditing({manifests, dependencyAuditing: {files}})
}

function expectRecognized(files: SourceFile[], manifests?: ManifestFile[]) {
  expect(scan(files, manifests)).toEqual({issues: []})
}

function expectMissing(files: SourceFile[], manifests?: ManifestFile[]) {
  const result = scan(files, manifests)
  expect(result.unresolvedReason).toBeUndefined()
  expect(result.issues).toHaveLength(1)
  expect(result.issues[0]).toMatchObject({
    id: 'MISSING_DEPENDENCY_AUDITING',
    severity: 'low',
    points: -5,
    title: 'Dependency auditing configuration not detected',
    location: {file: manifests?.[0]?.path ?? 'package.json'},
    fix: {automated: false},
  })
}

function expectUnresolved(files: SourceFile[], manifests?: ManifestFile[]) {
  const result = scan(files, manifests)
  expect(result.issues).toEqual([])
  expect(result.unresolvedReason).toBeTruthy()
}

describe('dependency-auditing applicability and finding', () => {
  test('is not applicable without a manifest that declares dependencies', () => {
    const emptyManifest = {...manifest(), dependencies: {}}
    expect(scan([], [emptyManifest])).toEqual({issues: []})
  })

  test('emits exactly one finding anchored to an actual dependency manifest', () => {
    const manifests = [manifest('packages/web/package.json'), manifest('package.json')]
    const result = scan([], manifests)

    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toEqual({
      id: 'MISSING_DEPENDENCY_AUDITING',
      severity: 'low',
      points: -5,
      title: 'Dependency auditing configuration not detected',
      message:
        'No recognized dependency-auditing configuration was found in the inspected files. Add an automated dependency vulnerability check, or verify that your existing integration covers this app. Hosted integrations and repository settings were not inspected.',
      location: {file: 'package.json'},
      fix: {automated: false, description: 'Add an automated dependency vulnerability check for this package.'},
    })
  })

  test('preserves a scanner discovery obstacle without emitting a finding', () => {
    expect(
      scanDependencyAuditing({
        manifests: [manifest()],
        dependencyAuditing: {files: [], unresolvedReason: 'The app is nested below the repository root.'},
      }),
    ).toEqual({issues: [], unresolvedReason: 'The app is nested below the repository root.'})
  })

  test.each(['', '# comments only\n', 'null\n'])('treats empty YAML as no evidence', (content) => {
    expectMissing([configuration('.github/workflows/empty.yml', content)])
  })
})

describe('GitHub Actions recognition', () => {
  test.each([
    ['dependency review action', '      - uses: actions/dependency-review-action@v4'],
    [
      'OSV reusable workflow',
      undefined,
      `on: pull_request
jobs:
  osv:
    uses: google/osv-scanner/.github/workflows/osv-scanner-reusable-pr.yml@v2.0.1`,
    ],
    ['Snyk Node action', '      - uses: snyk/actions/node@master'],
    ['npm audit', '      - run: npm audit --audit-level=high'],
    ['pnpm audit', '      - run: pnpm audit'],
    ['Yarn classic audit', '      - run: yarn audit'],
    ['Yarn modern audit', '      - run: yarn npm audit'],
    ['Snyk test', '      - run: npx snyk test --severity-threshold=high'],
    ['Semgrep supply chain', '      - run: semgrep ci --supply-chain'],
    ['continue-on-error audit', '      - run: npm audit\n        continue-on-error: true'],
  ])('recognizes %s', (_name, step, completeWorkflow?: string) => {
    const file = completeWorkflow
      ? configuration('.github/workflows/security.yml', completeWorkflow)
      : github(`    steps:\n${step}`)
    expectRecognized([file])
  })

  test.each([
    ['disabled job', github(`    if: ${['$', '{{ false }}'].join('')}\n    steps:\n      - run: npm audit`)],
    ['disabled step', github('    steps:\n      - if: false\n        run: npm audit')],
    [
      'disabled dependency review vulnerability check',
      github(
        '    steps:\n      - uses: actions/dependency-review-action@v4\n        with:\n          vulnerability-check: false',
      ),
    ],
    ['Snyk setup action', github('    steps:\n      - uses: snyk/actions/setup@master')],
    ['Snyk code action', github('    steps:\n      - uses: snyk/actions/code@master')],
    ['Snyk container action', github('    steps:\n      - uses: snyk/actions/docker@master')],
    ['scanner installation', github('    steps:\n      - run: npm install --global snyk')],
    ['step name', github('    steps:\n      - name: npm audit\n        run: npm test')],
    ['comment', github('    steps:\n      - run: |\n          # npm audit\n          npm test')],
    ['echo output', github('    steps:\n      - run: echo "npm audit"')],
    ['printf output', github("    steps:\n      - run: printf 'snyk test\\n'")],
    ['Dependabot update action', github('    steps:\n      - uses: dependabot/fetch-metadata@v2')],
    ['CodeQL action', github('    steps:\n      - uses: github/codeql-action/analyze@v3')],
    ['workflow metadata only', configuration('.github/workflows/ci.yml', 'name: npm audit')],
  ])('does not recognize %s', (_name, file) => expectMissing([file]))

  test('matches a straightforward working-directory to the dependency manifest', () => {
    const file = github(
      '    defaults:\n      run:\n        working-directory: packages/web\n    steps:\n      - run: npm audit',
    )
    expectRecognized([file], [manifest('packages/web/package.json')])
    expectMissing([file], [manifest('packages/admin/package.json')])
  })

  test('matches explicit scanner files and excludes unrelated paths and ecosystems', () => {
    const scopedSnyk = github(
      '    steps:\n      - uses: snyk/actions/node@master\n        with:\n          args: --file=packages/web/package.json --package-manager=npm',
    )
    expectRecognized([scopedSnyk], [manifest('packages/web/package.json')])
    expectMissing([scopedSnyk], [manifest('packages/admin/package.json')])

    const unrelated = github(
      '    steps:\n      - uses: snyk/actions/node@master\n        with:\n          args: --file=requirements.txt --package-manager=poetry',
    )
    expectMissing([unrelated])
  })

  test.each(['install', 'monitor', 'auth', 'help'])('does not recognize Snyk action command %s', (command) => {
    expectMissing([
      github(`    steps:\n      - uses: snyk/actions/node@master\n        with:\n          command: ${command}`),
    ])
  })

  test('recognizes only the Snyk Node action default or exact test command', () => {
    expectRecognized([github('    steps:\n      - uses: snyk/actions/node@master')])
    expectRecognized([
      github('    steps:\n      - uses: snyk/actions/node@master\n        with:\n          command: test'),
    ])
    expectMissing([
      github(
        '    steps:\n      - uses: snyk/actions/node@master\n        with:\n          command: test --all-projects',
      ),
    ])
  })

  test.each([
    'npm audit --help',
    'pnpm audit --version',
    'yarn npm audit --help',
    'snyk test --help',
    'snyk test --package-manager=pip',
    'snyk test --file=requirements.txt',
  ])('does not treat non-scanning command %s as an audit', (command) => {
    expectMissing([github(`    steps:\n      - run: ${command}`)])
  })

  test('runs actions at checkout root rather than defaults.run working-directory', () => {
    const file = github(
      '    defaults:\n      run:\n        working-directory: packages/web\n    steps:\n      - uses: snyk/actions/node@master',
    )
    expectMissing([file], [manifest('packages/web/package.json')])
    expectRecognized([file], [manifest('package.json')])
  })

  test('does not trust scoped OSV workflow inputs or dependency-review config files', () => {
    expectUnresolved([
      configuration(
        '.github/workflows/security.yml',
        'on: pull_request\njobs:\n  osv:\n    uses: google/osv-scanner/.github/workflows/osv-scanner-reusable-pr.yml@v2.0.1\n    with:\n      scan-args: --lockfile=other/package-lock.json',
      ),
    ])
    expectUnresolved([
      github(
        '    steps:\n      - uses: actions/dependency-review-action@v4\n        with:\n          config-file: .github/dependency-review.yml',
      ),
    ])
  })

  const dynamicWorkingDirectory = ['$', '{{ github.workspace }}'].join('')
  test.each([
    ['workflow', `defaults:\n  run:\n    working-directory: ${dynamicWorkingDirectory}\n`],
    ['job', ''],
  ])('leaves dynamic %s defaults.run working-directory unresolved', (_scope, workflowDefaults) => {
    const jobDefaults = workflowDefaults
      ? ''
      : `    defaults:\n      run:\n        working-directory: ${dynamicWorkingDirectory}\n`
    const file = configuration(
      '.github/workflows/ci.yml',
      `on: push\n${workflowDefaults}jobs:\n  check:\n    runs-on: ubuntu-latest\n${jobDefaults}    steps:\n      - run: npm audit`,
    )
    expectUnresolved([file])
  })

  test.each([
    '    if: false\n    steps: invalid',
    '    steps:\n      - if: false\n        run: [npm, audit]\n        uses: 123\n        with: invalid',
    '    defaults: invalid\n    steps:\n      - uses: actions/setup-node@v4',
    '    steps:\n      - uses: snyk/actions/node@master\n        with:\n          command: monitor\n          args: [invalid]',
  ])('does not validate configuration that is not executed: %s', (body) => {
    expectMissing([github(body)])
  })

  test.each([
    '    defaults: invalid\n    steps:\n      - run: npm audit\n        working-directory: .',
    '    defaults:\n      run:\n        working-directory: [invalid]\n        shell: [invalid]\n    steps:\n      - run: npm audit\n        working-directory: .\n        shell: bash',
    '    defaults: invalid\n    steps:\n      - uses: actions/dependency-review-action@v4',
    '    steps:\n      - uses: actions/dependency-review-action@v4\n        with:\n          fail-on-severity: high',
    '    steps:\n      - run: npm audit\n      - run: [invalid]',
  ])('retains independent evidence and overridden defaults: %s', (body) => {
    expectRecognized([github(body)])
  })

  test.each(['workflow_call', '[workflow_call]', '{workflow_call: {inputs: {}}}'])(
    'does not validate jobs in a reusable-only definition: %s',
    (trigger) => {
      expectMissing([configuration('.github/workflows/reusable.yml', `on: ${trigger}\njobs: invalid`)])
    },
  )

  test('keeps other workflow triggers when checking reusable-only definitions', () => {
    expectRecognized([
      configuration(
        '.github/workflows/security.yml',
        'on: {workflow_call: {}, push: {}}\njobs:\n  audit:\n    steps:\n      - run: npm audit',
      ),
    ])
  })

  test.each(['null', '[]', '{unexpected-input: true}'])('does not discard unsupported OSV inputs: %s', (inputs) => {
    expectUnresolved([
      configuration(
        '.github/workflows/security.yml',
        `on: push\njobs:\n  audit:\n    uses: google/osv-scanner/.github/workflows/osv-scanner-reusable.yml@v2.0.1\n    with: ${inputs}`,
      ),
    ])
  })

  test('treats malformed jobs, steps, and run values as unresolved', () => {
    expectUnresolved([configuration('.github/workflows/ci.yml', 'on: push\njobs:\n  check: invalid')])
    expectUnresolved([github('    steps: invalid')])
    expectUnresolved([github('    steps:\n      - run: [npm, audit]')])
  })
})

describe('package scripts and bounded shell handling', () => {
  test('follows one literal CI-invoked package script', () => {
    expectRecognized(
      [github('    steps:\n      - run: npm run security')],
      [manifest('package.json', {security: 'snyk test'})],
    )
    expectRecognized(
      [github('    steps:\n      - run: npm --prefix packages/web run security')],
      [manifest('packages/web/package.json', {security: 'npm audit'})],
    )
  })

  test('lets explicitly recursive supply-chain scans cover nested manifests', () => {
    expectRecognized(
      [github('    steps:\n      - run: semgrep ci --supply-chain')],
      [manifest('packages/web/package.json')],
    )
    expectRecognized(
      [github('    steps:\n      - run: snyk test --all-projects')],
      [manifest('packages/web/package.json')],
    )
  })

  test('does not inspect unused package scripts', () => {
    expectMissing(
      [github('    steps:\n      - run: npm test')],
      [manifest('package.json', {test: 'vitest', security: 'npm audit'})],
    )
  })

  test('does not mistake a package script named audit for an executed scanner', () => {
    expectMissing(
      [github('    steps:\n      - run: npm run audit')],
      [manifest('package.json', {audit: 'echo no scan'})],
    )
  })

  test.each([
    ['nested package script', 'npm run security', {security: 'npm run actual', actual: 'npm audit'}],
    ['local shell script', 'bash scripts/security.sh', undefined],
    ['local executable', './scripts/security.sh', undefined],
    ['shell variable', '$SECURITY_COMMAND', undefined],
    ['shell control flow', 'if npm audit; then echo ok; fi', undefined],
    ['shell interpreter command', 'sh -c "npm audit"', undefined],
  ])('leaves %s unresolved', (_name, command, scripts) => {
    const result = scan([github(`    steps:\n      - run: ${command}`)], [manifest('package.json', scripts)])
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toBeTruthy()
  })

  test('allows recognized evidence despite an unrelated unsupported script', () => {
    expectRecognized([github('    steps:\n      - run: ./scripts/build.sh\n      - run: pnpm audit')])
  })

  test.each([
    'if false; then npm audit; fi',
    'echo start; if false; then echo skipped; fi; npm audit',
    'cat <<EOF\nnpm audit\nEOF',
    'echo "unterminated\nnpm audit',
    'echo ignored # comment \\\n      npm audit',
  ])('does not let evidence escape unsupported execution block %s', (command) => {
    expectUnresolved([github(`    steps:\n      - run: |\n          ${command.replaceAll('\n', '\n          ')}`)])
  })

  test('still accepts a distinct supported step after an unsupported execution block', () => {
    expectRecognized([github('    steps:\n      - run: if false; then npm audit; fi\n      - run: npm audit')])
  })

  test('handles escaped-newline command continuation and ignores quoted separators', () => {
    expectRecognized([github('    steps:\n      - run: |\n          npm \\\n            audit')])
    expectMissing([github('    steps:\n      - run: echo "ignored; npm audit"')])
    expectMissing([github("    steps:\n      - run: printf 'ignored\\n| snyk test'")])
  })

  test.each(['cd ../; npm audit', 'cd /tmp; npm audit', 'cd $DIR; npm audit'])(
    'leaves unsafe directory change %s unresolved',
    (command) => expectUnresolved([github(`    steps:\n      - run: ${command}`)]),
  )

  test.each([
    'npm --prefix ../ audit',
    'pnpm --dir /tmp audit',
    'yarn --cwd $DIR npm audit',
    'npm --workspace other audit',
    'pnpm --filter unrelated audit',
    'npm --silent audit',
    'npm --prefix= audit',
    'snyk test --file=',
    'npm run $SCRIPT',
    'npm run missing',
  ])('leaves unsupported target or package-script invocation unresolved: %s', (command) => {
    expectUnresolved([github(`    steps:\n      - run: ${command}`)])
  })

  test.each(['npm --prefix packages/web audit', 'pnpm --dir packages/web audit', 'yarn --cwd packages/web npm audit'])(
    'supports a bounded literal package directory: %s',
    (command) => {
      expectRecognized([github(`    steps:\n      - run: ${command}`)], [manifest('packages/web/package.json')])
    },
  )

  test('leaves package-script arguments unresolved rather than ignoring them', () => {
    expectUnresolved(
      [github('    steps:\n      - run: npm run security -- --help')],
      [manifest('package.json', {security: 'snyk test'})],
    )
  })
})

describe('GitLab dependency scanning', () => {
  test.each(['Security/Dependency-Scanning.gitlab-ci.yml', 'Jobs/Dependency-Scanning.gitlab-ci.yml'])(
    'recognizes the %s template',
    (template) => expectRecognized([gitlab(`include:\n  - template: ${template}`)]),
  )

  test('recognizes explicit commands only in executable job fields', () => {
    expectRecognized(
      [gitlab('security:\n  script:\n    - cd packages/web\n    - npm audit')],
      [manifest('packages/web/package.json')],
    )
    expectMissing([gitlab('variables:\n  AUDIT_EXAMPLE: "npm audit"\nsecurity:\n  script: npm test')])
  })

  test('ignores an unexecuted hidden job and an always-disabled job', () => {
    expectMissing([
      gitlab(
        '.audit-template:\n  script: npm audit\naudit:\n  when: never\n  script: npm audit\nbuild:\n  script: npm test',
      ),
    ])
  })

  test('leaves an unknown include unresolved, unless direct evidence is present', () => {
    const unknown = gitlab('include:\n  - local: .gitlab/security.yml\nbuild:\n  script: npm test')
    expect(scan([unknown])).toMatchObject({issues: [], unresolvedReason: expect.any(String)})

    expectRecognized([gitlab('include:\n  - project: platform/ci\n    file: audit.yml\naudit:\n  script: npm audit')])
  })

  test('does not recognize disabled dependency-scanning templates or pipelines', () => {
    expectMissing([
      gitlab('include:\n  - template: Security/Dependency-Scanning.gitlab-ci.yml\n    rules:\n      - when: never'),
    ])
    expectMissing([
      gitlab('variables:\n  DS_DISABLED: "true"\ninclude:\n  - template: Security/Dependency-Scanning.gitlab-ci.yml'),
    ])
    expectMissing([
      gitlab(
        'workflow:\n  rules:\n    - if: $ON_BRANCH\n      when: never\n    - when: never\ninclude:\n  - template: Security/Dependency-Scanning.gitlab-ci.yml',
      ),
    ])
  })

  test('leaves conditional includes unresolved', () => {
    expectUnresolved([
      gitlab(
        'include:\n  - template: Security/Dependency-Scanning.gitlab-ci.yml\n    rules:\n      - if: $RUN_SECURITY',
      ),
    ])
  })

  test('keeps one shell directory across inherited before_script and script fields', () => {
    const file = gitlab('before_script:\n  - cd packages/web\naudit:\n  script:\n    - npm audit')
    expectRecognized([file], [manifest('packages/web/package.json')])
    expectMissing([file], [manifest('package.json')])

    expectRecognized([gitlab('default:\n  before_script:\n    - npm audit\nbuild:\n  script: npm test')])
  })

  test('does not let a direct command bypass unsupported inheritance in the same job', () => {
    expectUnresolved([gitlab('.base:\n  script: npm test\naudit:\n  extends: .base\n  script: npm audit')])
    expectUnresolved([gitlab('before_script: npm audit\nbuild:\n  inherit: false\n  script: npm test')])
  })

  test.each([
    '.unused: invalid\nbuild:\n  script: npm test',
    'audit:\n  when: never\n  script: {invalid: true}',
    'audit:\n  rules:\n    - when: never\n  script: {invalid: true}',
    'workflow:\n  rules:\n    - when: never\nvariables: invalid\naudit: invalid',
    'include:\n  template: [invalid]\n  rules:\n    - when: never',
    'build:\n  before_script: {invalid: true}',
  ])('does not validate scripts or templates that do not execute: %s', (content) => {
    expectMissing([gitlab(content)])
  })

  test.each([
    'default:\n  before_script: {invalid: true}\naudit:\n  before_script: []\n  script: npm audit',
    'before_script: {invalid: true}\naudit:\n  before_script: []\n  script: npm audit',
    'variables:\n  EXAMPLE: [npm, audit]\naudit:\n  stage: security\n  script: npm audit',
    'broken: invalid\naudit:\n  script: npm audit',
  ])('preserves jobs and evidence when parsing configuration subsets: %s', (content) => {
    expectRecognized([gitlab(content)])
  })

  test('normalizes scalar and array scripts without sharing the after_script directory', () => {
    expectRecognized([
      gitlab('before_script: cd packages/web\naudit:\n  script: [npm test]\n  after_script: npm audit'),
    ])
  })

  test('treats malformed jobs and scripts as unresolved', () => {
    expectUnresolved([gitlab('audit: invalid')])
    expectUnresolved([gitlab('audit:\n  script:\n    command: npm audit')])
  })
})

describe('CircleCI dependency scanning', () => {
  const config = (workflowJobs: string, jobs: string, orbs = '  security: snyk/snyk@2.1.0') =>
    circle(`version: 2.1
orbs:
${orbs}
jobs:
${jobs}
workflows:
  checks:
    jobs:
${workflowJobs}`)

  test('resolves an arbitrary Snyk orb alias in a workflow-invoked job', () => {
    expectRecognized([
      config(
        '      - audit',
        '  audit:\n    steps:\n      - security/scan:\n          package-manager: npm\n          target-file: package.json',
      ),
    ])
  })

  test('recognizes a scalar Snyk scan in an invoked job', () => {
    expectRecognized([config('      - audit', '  audit:\n    steps:\n      - security/scan')])
  })

  test('recognizes an explicit run command in an invoked job', () => {
    expectRecognized([config('      - audit', '  audit:\n    steps:\n      - run: yarn npm audit')])
  })

  test('does not use an unused orb, alias, or job as evidence', () => {
    expectMissing([
      config(
        '      - build',
        '  build:\n    steps:\n      - run: npm test\n  audit:\n    steps:\n      - security/scan',
      ),
    ])
  })

  test('matches CircleCI target files and package managers to an actual manifest', () => {
    const file = config(
      '      - audit',
      '  audit:\n    working_directory: ~/project/packages/web\n    steps:\n      - security/scan:\n          package-manager: pnpm\n          target-file: package.json',
    )
    expectRecognized([file], [manifest('packages/web/package.json')])
    expectMissing([file], [manifest('packages/admin/package.json')])

    const unrelated = config(
      '      - audit',
      '  audit:\n    steps:\n      - security/scan:\n          package-manager: pip\n          target-file: requirements.txt',
    )
    expectMissing([unrelated])
  })

  test('leaves invoked custom and non-Snyk orb commands unresolved', () => {
    expectUnresolved([
      circle(
        'version: 2.1\ncommands:\n  security:\n    steps:\n      - run: npm audit\njobs:\n  build:\n    steps:\n      - security\nworkflows:\n  checks:\n    jobs:\n      - build',
      ),
    ])
    expectUnresolved([
      config('      - audit', '  audit:\n    steps:\n      - other/scan', '  other: acme/security@1.0.0'),
    ])
  })

  test('ignores unused custom commands and non-audit tools', () => {
    expectMissing([
      circle(
        'version: 2.1\ncommands:\n  security:\n    steps:\n      - run: npm audit\njobs:\n  build:\n    steps:\n      - run: gitleaks detect\nworkflows:\n  checks:\n    jobs:\n      - build',
      ),
    ])
  })

  test('does not recognize disabled workflows or run steps', () => {
    expectMissing([
      circle(
        'version: 2.1\njobs:\n  audit:\n    steps:\n      - run: npm audit\nworkflows:\n  checks:\n    when: false\n    jobs:\n      - audit',
      ),
    ])
    expectMissing([
      config(
        '      - audit',
        '  audit:\n    steps:\n      - run:\n          when: never\n          command: npm audit',
      ),
    ])
  })

  test.each([
    '    working_directory: $PROJECT_DIR',
    '    working_directory: /tmp',
    '    working_directory: ~/other/project',
  ])('leaves unsupported CircleCI job directory unresolved', (workingDirectory) => {
    expectUnresolved([config('      - audit', `  audit:\n${workingDirectory}\n    steps:\n      - run: npm audit`)])
  })

  test('leaves unsupported CircleCI run directory unresolved', () => {
    expectUnresolved([
      config(
        '      - audit',
        '  audit:\n    steps:\n      - run:\n          working_directory: ../\n          command: npm audit',
      ),
    ])
  })

  test.each([
    'jobs: invalid\ncommands: invalid',
    'workflows:\n  checks:\n    when: false\n    jobs: invalid',
    'jobs:\n  build:\n    steps:\n      - run: npm test\n  unused: invalid\nworkflows:\n  checks:\n    jobs: [build]',
  ])('does not validate configuration outside invoked workflows: %s', (content) => {
    expectMissing([circle(content)])
  })

  test.each([
    '      - run:\n          when: never\n          command: [invalid]\n          working_directory: [invalid]',
    '      - when:\n          condition: false\n          steps:\n            - run: [invalid]',
    '      - security/scan:\n          package-manager: pip\n          target-file: [invalid]',
  ])('does not validate disabled execution or unsupported ecosystems: %s', (steps) => {
    expectMissing([config('      - audit', `  audit:\n    steps:\n${steps}`)])
  })

  test.each([
    '      - security/scan:\n          target-file: package.json\n          file: [invalid]\n          monitor-on-build: false',
    '      - run: {command: npm audit, name: audit dependencies}',
    '      - when:\n          condition: true\n          steps:\n            - run: npm audit',
    '      - run: [invalid]\n      - run: npm audit',
  ])('retains selected targets, nested execution, and independent evidence: %s', (steps) => {
    expectRecognized([config('      - audit', `  audit:\n    steps:\n${steps}`)])
  })

  test.each(['      - {audit: {}, build: {}}', '      - {}', '      - null'])(
    'rejects malformed job invocations without stripping keys: %s',
    (invocation) => {
      expectUnresolved([config(invocation, '  audit:\n    steps:\n      - run: npm audit')])
    },
  )

  test.each([
    '      - run: npm audit\n        unexpected: true',
    '      - when:\n          condition: false\n          steps: invalid',
  ])('retains structural obstacles in steps: %s', (steps) => {
    expectUnresolved([config('      - audit', `  audit:\n    steps:\n${steps}`)])
  })

  test('does not treat unsupported orb declarations as a reason to discard independent evidence', () => {
    expectRecognized([
      circle(
        'orbs: invalid\njobs:\n  audit:\n    steps:\n      - run: npm audit\nworkflows:\n  checks:\n    jobs:\n      - audit: {name: dependency audit}',
      ),
    ])
  })

  test('treats malformed jobs, steps, and run commands as unresolved', () => {
    expectUnresolved([config('      - audit', '  audit: invalid')])
    expectUnresolved([config('      - audit', '  audit:\n    steps: invalid')])
    expectUnresolved([config('      - audit', '  audit:\n    steps:\n      - run:\n          command: [npm, audit]')])
  })
})

describe('execution boundaries', () => {
  test.each(['repository: other/project', 'path: other'])('leaves a scoped checkout unresolved (%s)', (input) => {
    const file = github(
      `    steps:\n      - uses: actions/checkout@v4\n        with:\n          ${input}\n      - run: npm audit`,
    )
    expect(scan([file])).toMatchObject({issues: [], unresolvedReason: expect.any(String)})
  })

  test('does not recognize an uninvoked reusable-only workflow', () => {
    const file = configuration(
      '.github/workflows/reusable.yml',
      'on: workflow_call\njobs:\n  audit:\n    steps:\n      - run: npm audit',
    )
    expectMissing([file])
  })

  test('honors disabled jobs inherited through YAML merge keys', () => {
    const file = gitlab('.disabled: &disabled\n  when: never\naudit:\n  <<: *disabled\n  script: npm audit')
    expectMissing([file])
  })

  test('does not lose unknown CircleCI orb jobs when there are no local jobs', () => {
    const file = circle(
      'version: 2.1\norbs:\n  security: example/security@1\nworkflows:\n  audit:\n    jobs:\n      - security/audit',
    )
    expect(scan([file])).toMatchObject({issues: [], unresolvedReason: expect.any(String)})
  })

  test('does not attribute a scoped CircleCI checkout to the app root', () => {
    const file = circle(
      'version: 2.1\njobs:\n  audit:\n    steps:\n      - checkout:\n          path: other\n      - run: npm audit\nworkflows:\n  checks:\n    jobs:\n      - audit',
    )
    expect(scan([file])).toMatchObject({issues: [], unresolvedReason: expect.any(String)})
  })
  test.each([
    ['quoted heredoc', "cat <<'EOF'\nnpm audit\nEOF"],
    ['function definition', 'audit() {\n npm audit\n}'],
  ])('does not count commands inside %s', (_name, command) => {
    const file = github(
      `    steps:\n      - run: |\n${command
        .split('\n')
        .map((line) => `          ${line}`)
        .join('\n')}`,
    )
    expect(scan([file])).toMatchObject({issues: [], unresolvedReason: expect.any(String)})
  })

  test('does not count an audit printed through a custom shell', () => {
    expect(scan([github('    steps:\n      - run: npm audit\n        shell: echo {0}')])).toMatchObject({
      issues: [],
      unresolvedReason: expect.any(String),
    })
  })

  test.each(['pnpm install', 'yarn install', 'pnpm add snyk'])(
    'treats %s as setup, not a script reference',
    (command) => {
      expectMissing([github(`    steps:\n      - run: ${command}`)])
    },
  )

  test('does not crash on unsupported GitLab rule value objects', () => {
    const file = gitlab('audit:\n  when: {toString: false}\n  script: echo done')
    expect(() => scan([file])).not.toThrow()
  })
})

describe('configuration obstacles', () => {
  test.each([
    ['malformed GitHub workflow', configuration('.github/workflows/ci.yml', 'jobs: [')],
    ['malformed GitLab configuration', gitlab('include: [')],
    ['malformed CircleCI configuration', circle('jobs: {')],
    [
      'excessive YAML aliases',
      github(
        `    x: &values [one, two]\n    y: [${Array.from({length: 21}, () => '*values').join(', ')}]\n    steps:\n      - run: npm test`,
      ),
    ],
    [
      'unsupported GitLab YAML reference',
      gitlab('.security:\n  script: npm audit\naudit:\n  script: !reference [.security, script]'),
    ],
    [
      'unknown GitHub reusable workflow',
      configuration(
        '.github/workflows/ci.yml',
        'on: push\njobs:\n  delegated:\n    uses: acme/ci/.github/workflows/security.yml@v1',
      ),
    ],
    ['unknown local GitHub action', github('    steps:\n      - uses: ./.github/actions/security')],
    [
      'unknown CircleCI invoked job',
      circle('version: 2.1\njobs: {}\nworkflows:\n  checks:\n    jobs:\n      - delegated'),
    ],
  ])('returns no finding and an unresolved reason for %s', (_name, file) => {
    const result = scan([file])
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toBeTruthy()
  })

  test('malformed relevant YAML remains unresolved even when another file has evidence', () => {
    const result = scan([
      github('    steps:\n      - run: npm audit'),
      configuration('.github/workflows/malformed.yml', 'jobs: ['),
    ])
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toContain('malformed')
  })
})
