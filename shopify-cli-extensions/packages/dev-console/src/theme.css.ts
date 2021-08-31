
import {createTheme} from '@vanilla-extract/css';

export const raw = {
  color: {
    background: '#38393a',
    backgroundHover: '#4e4f51',
    dark: '#202123',

    text: '#ffffff',
    subdued: '#a7aaad',

    active: '#36a3ff',
    connected: '#00a47c',
    disconnected: '#b98900',
    error: '#d92800',
  },
  font: '"SF Mono", monospace',
  border: {radius: '10px'},
};

export const [Theme, {color, font, border}] = createTheme(raw);
