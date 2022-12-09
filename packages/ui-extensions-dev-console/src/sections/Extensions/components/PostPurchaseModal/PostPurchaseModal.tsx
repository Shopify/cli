import React from 'react'
import {Link, Modal, ModalProps, Stack, TextStyle} from '@shopify/polaris'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'

export interface Props extends Pick<ModalProps, 'onClose'> {
  extension?: ExtensionPayload
}

export function PostPurchaseModal({extension, onClose}: Props) {
  if (!extension) {
    return null
  }

  return (
    <Modal open={true} title={`How to preview ${extension?.title}`} onClose={onClose}>
      <Modal.Section>
        <Stack vertical>
          <p>
            This page is served by your local UI Extension development server. Instead of visiting this page directly,
            you will need to connect your local development environment to a real checkout environment.
          </p>
          <p>
            If this is the first time you're testing a Post Purchase extension, please install the browser extension
            from{' '}
            <Link url="https://github.com/Shopify/post-purchase-devtools/releases" external>
              https://github.com/Shopify/post-purchase-devtools/releases
            </Link>
          </p>
          <p>
            Once installed, simply enter your extension URL:
            <br />
            <br />
            <TextStyle variation="code">{extension.development.root.url}</TextStyle>
          </p>
        </Stack>
      </Modal.Section>
    </Modal>
  )
}
