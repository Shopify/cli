import {style} from '@vanilla-extract/css';
import {font} from '@/theme.css';

export const CopyLink = style({
  fontFamily: font,
  textAlign: 'right',
});

export const PopoverContent = style({
  fontFamily: font,
  width: '128px',
  wordWrap: 'break-word',
});

export const ActionGroup = style({
  display: 'flex',
  justifyContent: 'flex-end',
});
