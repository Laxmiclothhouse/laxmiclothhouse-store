export function whatsappShareLink(phone, text) {
  const msg = encodeURIComponent(text || '');
  const phonePart = phone ? `?phone=${String(phone).replace(/\D/g, '')}` : '';
  return `https://wa.me/${phonePart}&text=${msg}`;
}
