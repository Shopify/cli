import React, {MouseEvent, useCallback, useMemo} from 'react';
import {useI18n} from '@shopify/react-i18n';
import {ExtensionPayload} from '@shopify/ui-extensions-dev-console';

import {Checkbox} from '../CheckBox';
import {ActionSet, ActionSetProps} from '../ActionSet';

import * as styles from './ExtensionRow.module.scss';
import en from './translations/en.json';

export type ExtensionRowProps = {
  extension: ExtensionPayload;
  selected?: boolean;
  onSelect(extension: ExtensionPayload): void;
  onHighlight(extension: ExtensionPayload): void;
  onClearHighlight(): void;
} & Pick<ActionSetProps, 'activeMobileQRCode' | 'onShowMobileQRCode' | 'onCloseMobileQRCode'>;

export function ExtensionRow({
  extension,
  selected,
  onSelect,
  onHighlight,
  onClearHighlight,
  ...actionSetProps
}: ExtensionRowProps) {
  const [i18n] = useI18n({
    id: 'ExtensionRow',
    fallback: en,
  });
  const {
    assets,
    development: {hidden, status},
  } = extension;

  const {name, url: scriptUrl} = assets.main;

  const scriptHost = useMemo(() => {
    if (!scriptUrl) return null;
    const url = new URL(scriptUrl.toString());
    return `${url.protocol}//${url.host}`;
  }, [scriptUrl]);

  const handleSelect = useCallback(
    (event?: MouseEvent) => {
      if (event) event.stopPropagation();
      onSelect(extension);
    },
    [extension, onSelect],
  );

  const textClass = hidden ? styles.Hidden : undefined;
  const statusClass = status ? (styles as any)[status || 'error'] : styles.error;

  return (
    <tr
      className={styles.DevToolRow}
      onClick={handleSelect}
      onMouseEnter={() => onHighlight(extension)}
      onMouseLeave={onClearHighlight}
    >
      <td>
        <Checkbox label="" checked={selected} onChange={() => handleSelect()} />
      </td>
      <td className={textClass}>{name}</td>
      <td className={textClass}>{extension.type}</td>
      <td className={textClass}>
        <a className={styles.Url} href={scriptHost || '#'}>
          {scriptHost}
        </a>
      </td>
      <td>
        <span className={`${styles.Status} ${statusClass}`}>
          {i18n.translate(`statuses.${status}`)}
        </span>
      </td>
      <ActionSet
        className={styles.ActionSet}
        selected={selected}
        extension={extension}
        {...actionSetProps}
      />
    </tr>
  );
}
