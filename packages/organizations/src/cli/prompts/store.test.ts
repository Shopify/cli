import {storeChoiceList} from './store.js'
import {describe, expect, test, vi} from 'vitest'

interface TestStore {
  shopId: string
  shopDomain: string
  shopName?: string
  extra?: string
}

const first: TestStore = {shopId: '1', shopDomain: 'first.myshopify.com', shopName: 'First', extra: 'kept'}
const second: TestStore = {shopId: '2', shopDomain: 'second.myshopify.com', shopName: 'Second'}
const third: TestStore = {shopId: '3', shopDomain: 'third.myshopify.com', shopName: 'Third'}

function toChoice(store: TestStore) {
  return {id: store.shopId, domain: store.shopDomain, ...(store.shopName ? {name: store.shopName} : {})}
}

function listFor(stores: TestStore[], overrides = {}) {
  return storeChoiceList({stores, toChoice, ...overrides})
}

describe('storeChoiceList', () => {
  test('names each store by its name and domain', () => {
    expect(listFor([first, second]).promptProps.choices).toEqual([
      {label: 'First (first.myshopify.com)', value: '1'},
      {label: 'Second (second.myshopify.com)', value: '2'},
    ])
  })

  test('names stores without the domain when showDomain is false', () => {
    expect(listFor([first], {showDomain: false}).promptProps.choices).toEqual([{label: 'First', value: '1'}])
  })

  test('falls back to the domain for a store with no name', () => {
    const stores = [{shopId: '1', shopDomain: 'first.myshopify.com'}]

    expect(listFor(stores).promptProps.choices).toEqual([{label: 'first.myshopify.com', value: '1'}])
  })

  test('falls back to the name for a store with no domain', () => {
    const stores = [{shopId: '1', shopDomain: '', shopName: 'First'}]

    expect(listFor(stores).promptProps.choices).toEqual([{label: 'First', value: '1'}])
  })

  test('offers the extra choices below the stores', () => {
    const extraChoices = [{label: 'Create a new dev store', value: 'create'}]

    expect(listFor([first], {extraChoices}).promptProps.choices).toEqual([
      {label: 'First (first.myshopify.com)', value: '1'},
      {label: 'Create a new dev store', value: 'create'},
    ])
  })

  test('resolves a submitted value back to the caller store, shape intact', () => {
    expect(listFor([first, second]).storeFor('1')).toEqual(first)
  })

  test('leaves search unset when the caller cannot search remotely, so the prompt filters in memory', () => {
    expect(listFor([first]).promptProps).not.toHaveProperty('search')
  })

  test('labels remote search results and reports whether more pages remain', async () => {
    const onSearch = vi.fn().mockResolvedValue({stores: [third], hasMorePages: true})
    const extraChoices = [{label: 'Create a new dev store', value: 'create'}]

    const results = await listFor([first], {onSearch, extraChoices}).promptProps.search!('thi')

    expect(onSearch).toHaveBeenCalledWith('thi')
    expect(results.data).toEqual([
      {label: 'Third (third.myshopify.com)', value: '3'},
      {label: 'Create a new dev store', value: 'create'},
    ])
    expect(results.meta).toEqual({hasNextPage: true})
  })

  test('resolves a store that only a search offered', async () => {
    const onSearch = vi.fn().mockResolvedValue({stores: [third], hasMorePages: false})
    const list = listFor([first], {onSearch})

    await list.promptProps.search!('thi')

    expect(list.storeFor('3')).toEqual(third)
  })

  test('still resolves a store from the initial list after a search', async () => {
    const onSearch = vi.fn().mockResolvedValue({stores: [third], hasMorePages: false})
    const list = listFor([first], {onSearch})

    await list.promptProps.search!('thi')

    expect(list.storeFor('1')).toEqual(first)
  })

  test('resolves nothing for a value that is not a store', () => {
    const extraChoices = [{label: 'Create a new dev store', value: 'create'}]

    expect(listFor([first], {extraChoices}).storeFor('create')).toBeUndefined()
  })
})
