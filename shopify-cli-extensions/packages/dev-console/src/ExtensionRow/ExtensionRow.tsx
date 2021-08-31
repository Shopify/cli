import React, {MouseEvent, useCallback, useMemo} from 'react';
import {useI18n} from '@shopify/react-i18n';

import {Checkbox} from '../CheckBox';
import {ActionSet, ActionSetProps} from '../ActionSet';

import * as styles from './ExtensionRow.css';
import {ExtensionManifestData, Status} from '../types';
import en from './translations/en.json';

export type ExtensionRowProps = {
  extension: ExtensionManifestData;
  selected?: boolean;
  onSelect(extension: ExtensionManifestData): void;
  onHighlight(extension: ExtensionManifestData): void;
  onClearHighlight(): void;
} & Pick<ActionSetProps, 'activeMobileQRCode' | 'onShowMobileQRCode'>;

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
    identifier,
    name,
    scriptUrl,
    status = Status.Connected,
    hidden,
  } = extension;

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
  const statusClass = status ? styles[status] : styles.BuildError;

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
      <td className={textClass}>{identifier}</td>
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
