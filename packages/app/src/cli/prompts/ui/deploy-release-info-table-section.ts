export interface DeployReleaseInfoTableSection<T> {
  new: T[]
  updated: T[]
  removed: T[]
}

interface ItemTemplate {
  bullet: string
  color: string
  suffix?: string
}

const NewItem = {
  bullet: '+',
  color: 'green',
  suffix: '(new)',
}

const RemovedItem = {
  bullet: '-',
  color: 'red',
  suffix: '(removed)',
}

export function buildDeployReleaseInfoTableSection<T>(section: DeployReleaseInfoTableSection<T>) {
  return [
    ...section.new.map((item) => buildItem(item, NewItem)),
    ...section.updated,
    ...section.removed.map((item) => buildItem(item, RemovedItem)),
  ]
}

function buildItem<T>(item: T, itemTemplate: ItemTemplate) {
  const itemContent = typeof item === 'string' ? [item, {subdued: itemTemplate.suffix ?? ''}] : item
  return {bullet: itemTemplate.bullet, item: itemContent, color: itemTemplate.color}
}
