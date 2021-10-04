import {style, globalStyle} from '@vanilla-extract/css';
import {raw, color, border} from '@/theme.css';

export const ActionSet = style({
  verticalAlign: 'middle',
  visibility: 'hidden',
});

export const Url = style({color: color.text});

export const DevToolRow = style({
  borderBottom: `1px solid ${color.dark}`,

  selectors: {
    '&:hover': {
      cursor: 'pointer',
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'><rect y='0.25rem' x='0.3rem' width='calc(100% - 0.6rem)' height='calc(100% - 0.4rem)' rx='5' style='fill:%23${raw.color.backgroundHover.slice(
        1,
      )};' /></svg>")`,
    },
  },
});

globalStyle(`${DevToolRow} td`, {padding: '1rem'});
globalStyle(`${DevToolRow} label`, {verticalAlign: 'middle'});
globalStyle(`${DevToolRow}:hover ${ActionSet}`, {visibility: 'visible'});

export const ForceVisible = style({});

globalStyle(`${ForceVisible} ${ActionSet}`, {visibility: 'visible'});

export const Hidden = style({
  textDecoration: 'line-through',
  color: color.subdued,
});

globalStyle(`${Hidden} ${Url}`, {color: color.subdued});

export const success = style({background: color.connected});
export const disconnected = style({background: color.disconnected});
export const error = style({background: color.error});

export const Status = style({
  fontSize: '13px',
  borderRadius: border.radius,
  padding: '0.25rem 1rem 0.5rem',
  whiteSpace: 'nowrap',
});
