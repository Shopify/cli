import React from 'react';
import {Popover, Spinner} from '@shopify/polaris';
import {useI18n} from '@shopify/react-i18n';

import {Action, ActionProps} from '../Action';

import en from './translations/en.json';
import * as styles from './PopoverAction.css';

export interface PopoverActionProps extends ActionProps {
  active: boolean;
  onClose: () => void;
  content?: React.ReactNode;
  loading: boolean;
}

export function PopoverAction(props: PopoverActionProps) {
  const {
    className,
    accessibilityLabel,
    source,
    onAction,
    active,
    onClose,
    content,
    loading,
  } = props;
  const [i18n] = useI18n({
    id: 'PopoverAction',
    fallback: en,
  });

  const loadingMarkup = (
    <div className={styles.LoadingAction}>
      <Spinner
        accessibilityLabel={i18n.translate('loading')}
        size="small" />
    </div>
  );
  const popoverMarkup = (
    <div onKeyDown={stopPropogation} onClick={stopPropogation}>
      <Popover
        active={active}
        onClose={onClose}
        activator={
          <Action
            source={source}
            accessibilityLabel={accessibilityLabel}
            onAction={onAction}
            className={className}
          />
        }
      >
        {content ? (
          <Popover.Pane fixed>
            <Popover.Section>{content}</Popover.Section>
          </Popover.Pane>
        ) : null}
      </Popover>
    </div>
  );

  return loading ? loadingMarkup : popoverMarkup;
}

function stopPropogation(event: any) {
  event.stopPropagation();
}
