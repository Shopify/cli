import {style, globalStyle} from '@vanilla-extract/css';

export const Action = style({});

globalStyle(`${Action} > button`, {
  background: 'transparent',
  border: 'none',
  width: '100%',
  margin: 'auto',
  verticalAlign: 'middle',
  cursor: 'pointer',
});
