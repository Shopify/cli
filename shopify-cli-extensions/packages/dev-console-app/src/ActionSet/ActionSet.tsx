import React, {useCallback, useMemo, useState} from 'react';
import {
  CircleAlertMajor,
  DuplicateMinor,
  HideMinor,
  MobileMajor,
  RefreshMinor,
  ViewMinor,
} from '@shopify/polaris-icons';
import {Button, Icon, Link, Stack} from '@shopify/polaris';
import {useI18n} from '@shopify/react-i18n';
import copyToClipboard from 'copy-to-clipboard';
import QRCode from 'qrcode.react';
import {ExtensionPayload} from '@shopify/ui-extensions-dev-console';
import {useDevConsoleInternal} from '@/hooks/useDevConsoleInternal';
import {useToast} from '@/hooks/useToast';

// eslint-disable-next-line @shopify/strict-component-boundaries
import * as rowStyles from '../ExtensionRow/ExtensionRow.module.scss';

import en from './translations/en.json';
import {Action} from './Action';
import {PopoverAction} from './PopoverAction';
import * as styles from './ActionSet.module.scss';

export interface ActionSetProps {
  className?: string;
  selected?: boolean;
  extension: ExtensionPayload;
  activeMobileQRCode?: boolean;
  onShowMobileQRCode?: (extension: ExtensionPayload) => void;
}

export function ActionSet(props: ActionSetProps) {
  const [i18n] = useI18n({
    id: 'ActionSet',
    fallback: en,
  });
  const {extension, className, activeMobileQRCode, onShowMobileQRCode} = props;
  const {app, store, refresh, hide, show} = useDevConsoleInternal();
  const hidden = extension.development.hidden;

  const handleShowHide = useCallback(() => {
    if (hidden) {
      show([extension]);
    } else {
      hide([extension]);
    }
  }, [extension, hidden, hide, show]);

  const refreshExtension = useCallback(() => refresh([extension]), [extension, refresh]);

  const showToast = useToast();
  const [mobileQRCode, setMobileQRCode] = useState<string | null>(null);
  const [mobileQRCodeState, setMobileQRCodeState] = useState<null | 'loading' | 'error'>(null);

  const closeMobileQRCodePopover = useCallback(() => {
    setMobileQRCode(null);
    setMobileQRCodeState(null);
  }, []);

  const showMobileQRCode = useCallback(async () => {
    if (app) {
      setMobileQRCode(
        `https://${store}/admin/extensions-dev/mobile?url=${extension.development.root.url}`,
      );
      setMobileQRCodeState(null);
    } else {
      setMobileQRCodeState('error');
    }
    onShowMobileQRCode?.(extension);
  }, [extension, onShowMobileQRCode, store, app]);

  const onButtonClick = useCallback(() => {
    if (mobileQRCode && copyToClipboard(mobileQRCode)) {
      showToast({
        content: i18n.translate('qrcode.copied'),
      });
    }
  }, [mobileQRCode, showToast, i18n]);

  const popoverContent = useMemo(() => {
    if (mobileQRCode) {
      return (
        <>
          <div className={styles.CopyLink}>
            <Button icon={DuplicateMinor} plain monochrome onClick={onButtonClick}>
              {i18n.translate('qrcode.copy')}
            </Button>
          </div>
          <QRCode value={mobileQRCode!} />
          <div className={styles.PopoverContent}>
            <p>
              {i18n.translate('qrcode.content', {
                thisExtension: <b>{i18n.translate('qrcode.thisExtension')}</b>,
              })}
            </p>
          </div>
        </>
      );
    }
    if (mobileQRCodeState === 'error') {
      return (
        <div className={styles.PopoverContent}>
          <Stack alignment="center" vertical>
            <Icon source={CircleAlertMajor} color="subdued" />
            <p>{i18n.translate('qrcode.loadError')}</p>
            <p>
              <Link monochrome onClick={showMobileQRCode}>
                {i18n.translate('qrcode.tryAgain')}
              </Link>
            </p>
          </Stack>
        </div>
      );
    }

    return null;
  }, [i18n, showMobileQRCode, onButtonClick, mobileQRCode, mobileQRCodeState]);

  return (
    <>
      <td>
        <div className={styles.ActionGroup}>
          <div className={`${hidden ? rowStyles.ForceVisible : ''}`}>
            <Action
              source={hidden ? HideMinor : ViewMinor}
              accessibilityLabel={hidden ? i18n.translate('show') : i18n.translate('hide')}
              onAction={handleShowHide}
              className={className}
            />
          </div>
          <PopoverAction
            source={MobileMajor}
            accessibilityLabel={i18n.translate('qrcode.action')}
            onAction={showMobileQRCode}
            active={activeMobileQRCode === true}
            onClose={closeMobileQRCodePopover}
            content={popoverContent}
            className={className}
            loading={mobileQRCodeState === 'loading'}
          />
          <Action
            source={RefreshMinor}
            accessibilityLabel={i18n.translate('refresh')}
            onAction={refreshExtension}
            className={className}
          />
        </div>
      </td>
    </>
  );
}
