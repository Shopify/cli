import {getLiquidTagContent} from './liquid-tag-content.js'
import {describe, expect, test} from 'vitest'

const scenarios = [
  {
    name: 'handles simple cases with all tags present',
    fileContent: `
      {% stylesheet %}
        .foo { color: red; }
      {% endstylesheet %}
      {% javascript %}
        console.log('hi');
      {% endjavascript %}
      {% schema %}
        { "name": "Test" }
      {% endschema %}
      <div>Other content</div>
    `,
    expected: {
      stylesheet: '.foo { color: red; }',
      javascript: "console.log('hi');",
      schema: '{ "name": "Test" }',
    },
  },
  {
    name: 'handles simple cases with extra whitespace',
    fileContent: `
      {%    stylesheet    %}
        .baz { color: green; }
      {%    endstylesheet    %}
      {%javascript%}
        alert('hi');
      {%endjavascript%}
      {%   schema   %}
        { "name": "Whitespace" }
      {%   endschema   %}
    `,
    expected: {
      stylesheet: '.baz { color: green; }',
      javascript: "alert('hi');",
      schema: '{ "name": "Whitespace" }',
    },
  },
  {
    name: 'handles dash cases with all tags present',
    fileContent: `
      {%- stylesheet -%}
        .foo { color: red; }
      {%- endstylesheet -%}
      {%- javascript -%}
        console.log('hi');
      {%- endjavascript -%}
      {%- schema -%}
        { "name": "Test" }
      {%- endschema -%}
      <div>Other content</div>
    `,
    expected: {
      stylesheet: '.foo { color: red; }',
      javascript: "console.log('hi');",
      schema: '{ "name": "Test" }',
    },
  },
  {
    name: 'detects dash cases with all tags present and whitespace',
    fileContent: `
      {%- stylesheet -%}
        .foo { color: red; }
      {%- endstylesheet -%}
      {% javascript       %}
        console.log('hi');
      {%- endjavascript -%}
      {%      schema -%}
        { "name": "Test" }
      {%-       endschema -%}
      <div>Other content</div>
    `,
    expected: {
      stylesheet: '.foo { color: red; }',
      javascript: "console.log('hi');",
      schema: '{ "name": "Test" }',
    },
  },
  {
    name: 'handles files when only the stylesheet tag is present',
    fileContent: `
      {% stylesheet %}
        .bar { color: blue; }
      {% endstylesheet %}
      <div>No other tags</div>
    `,
    expected: {
      stylesheet: '.bar { color: blue; }',
      javascript: '',
      schema: '',
    },
  },
  {
    name: 'handles files when no tags are present',
    fileContent: `
      <div>Just HTML, no tags</div>
    `,
    expected: {
      stylesheet: '',
      javascript: '',
      schema: '',
    },
  },
]

describe('getLiquidTagContent', () => {
  for (const scenario of scenarios) {
    test(scenario.name, () => {
      for (const tag of ['stylesheet', 'javascript', 'schema'] as const) {
        const expected = scenario.expected[tag]
        const actual = getLiquidTagContent(scenario.fileContent, tag) ?? ''

        expect(actual.trim()).toBe(expected.trim())
      }
    })
  }
})
