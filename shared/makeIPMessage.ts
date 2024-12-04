async function makeIPMessage() {
  const response = await fetch('https://api.ipify.org?format=json');
  const data = await response.json();
  const ipMessage = data?.ip ? ` by ${data.ip}` : '';
  return ipMessage;
}

export default makeIPMessage;
