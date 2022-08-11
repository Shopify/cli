import React, {MouseEvent} from 'react';
import {Icon, IconSource} from '@shopify/polaris';

import * as styles from './Action.module.scss';

export interface ActionProps {
  className?: string;
  accessibilityLabel: string;
  source: IconSource;
  onAction: () => void;
}

export function Action({accessibilityLabel, className, onAction, source}: ActionProps) {
  const onClick = (event: MouseEvent) => {
    event.stopPropagation();
    onAction();
  };

  return (
    <div className={styles.Action}>
      <button type="button" className={className} onClick={onClick}>
        <Icon source={source} accessibilityLabel={accessibilityLabel} />
      </button>
    </div>
  );
}
