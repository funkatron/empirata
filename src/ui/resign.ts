/** Classic ALG-AI-004 resignation modal. */
export function resignModal(
  dialog: HTMLDialogElement,
  accept: HTMLButtonElement,
  decline: HTMLButtonElement,
  title: HTMLElement,
  map: HTMLElement,
  onChoice: (accept: boolean) => void,
) {
  dialog.addEventListener('close', () => {
    if (!dialog.open) map.focus({ preventScroll: true });
  });
  accept.addEventListener('click', () => {
    onChoice(true);
    dialog.close();
  });
  decline.addEventListener('click', () => {
    onChoice(false);
    dialog.close();
  });
  return {
    open(computerLabel: string) {
      title.textContent = `${computerLabel} wishes to resign`;
      if (!dialog.open) {
        dialog.showModal();
        accept.focus();
      }
    },
    close() {
      if (dialog.open) dialog.close();
    },
    isOpen() {
      return dialog.open;
    },
  };
}