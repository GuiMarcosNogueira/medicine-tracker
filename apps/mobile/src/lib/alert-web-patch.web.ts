// Patches Alert.alert to use native browser dialogs on web.
// Imported once in _layout.tsx; all 30+ Alert.alert() calls work automatically.
import { Alert } from 'react-native';
import type { AlertButton } from 'react-native';

// globalThis is ES2020 and works in both browser and Node without DOM lib types.
declare const globalThis: { alert: (msg: string) => void; confirm: (msg: string) => boolean };

function buildMessage(title: string, message?: string): string {
  return message ? `${title}\n\n${message}` : title;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Alert as any).alert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void => {
  const cancelBtn = buttons?.find(b => b.style === 'cancel');
  const actionBtns = (buttons ?? []).filter(b => b.style !== 'cancel');

  if (actionBtns.length > 0 && cancelBtn) {
    // Destructive / confirm pattern → confirm()
    const confirmed = globalThis.confirm(buildMessage(title, message));
    if (confirmed) actionBtns[0]?.onPress?.();
    else cancelBtn.onPress?.();
  } else {
    // Simple notification → alert() then call the single onPress
    globalThis.alert(buildMessage(title, message));
    buttons?.[0]?.onPress?.();
  }
};
