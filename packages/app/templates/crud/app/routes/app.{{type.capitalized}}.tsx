import {json} from '@remix-run/node'
import {useLoaderData, Link, useNavigate} from '@remix-run/react'
import {authenticate} from '../shopify.server'
import {Card, EmptyState, Layout, Page, IndexTable} from '@shopify/polaris'

import {fetchMetaobjectList} from '../models/{{name}}'
import {variantTitle} from '~/utils'

// [START loader]
export async function loader({request}) {
  const {admin} = await authenticate.admin(request)

  return json({
    metaobjects: await fetchMetaobjectList(admin.graphql, {{metaobject.type}}),
  })
}
// [END loader]

// [START empty]
const EmptyListState = ({onAction}) => (
  <EmptyState
    heading="Create {{namePlural}}"
    action={{
      content: 'Create {{nameSingular}}',
      onAction,
    }}
    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
  >
    <p>Nothing created yet.</p>
  </EmptyState>
)
// [END empty]

function truncate(str, {length = 25} = {}) {
  if (!str) return ''
  if (str.length <= length) return str
  return str.slice(0, length) + '…'
}

// [START table]
const MetaobjectTable = ({items}) => (
  <IndexTable
    resourceName={{
      singular: '{{nameSingular}}',
      plural: '{{namePlural}}',
    }}
    itemCount={items.length}
    headings={[
      {% for field in metaobject.field_definitions %}
        { title: '{{ field.name }}' },
      {% endfor %}
    ]}
    selectable={false}
  >
    {items.map((item, index) => (
      <MetaobjectTableRow key={item.key} item={item} position={index} />
    ))}
  </IndexTable>
)
// [END table]

// [START row]
const MetaobjectTableRow = ({item, position}) => (
  <IndexTable.Row id={item.handle} position={position}>
    {% for field in metaobject.field_definitions %}
      <IndexTable.Cell>{truncate(item.fields.{{ field.name }})}</IndexTable.Cell>
    {% endfor %}
    <IndexTable.Cell>
      <Link to={`/app/{{metaobject.type}}/${item.handle}`}>View</Link>
    </IndexTable.Cell>
  </IndexTable.Row>
)

// [END row]

export default function Index() {
  const {metaobjects} = useLoaderData()
  const navigate = useNavigate()

  // [START page]
  return (
    <Page>
      <ui-title-bar title="{{namePlural}}">
        <button variant="primary" onClick={() => navigate('/app/{{metaobject.type}}/new')}>
          Create {{nameSingular}}}
        </button>
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {metaobjects.length === 0 ? (
              <EmptyListState onAction={() => navigate('{{metaobject.type}}/new')} />
            ) : (
              <MetaobjectTable items={metaobjects} />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
  // [END page]
}
