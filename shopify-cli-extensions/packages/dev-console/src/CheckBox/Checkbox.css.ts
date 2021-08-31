import {style, globalStyle} from '@vanilla-extract/css';

export const ConsoleCheckboxWrapper = style({
  paddingLeft: '1rem',
});

globalStyle(`${ConsoleCheckboxWrapper} span[class^="Polaris-Checkbox__Backdrop"]`, {
  backgroundColor: 'transparent',
});
