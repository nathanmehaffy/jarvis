/* eslint-disable @typescript-eslint/no-explicit-any */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'PROCESS_INPUT':
      const processedData = processInput(data);
      self.postMessage({
        type: 'INPUT_PROCESSED',
        data: processedData
      });
      break;
    
    case 'VALIDATE_INPUT':
      const isValid = validateInput(data);
      self.postMessage({
        type: 'INPUT_VALIDATED',
        data: { isValid, input: data }
      });
      break;
    
    default:
      console.warn(`Unknown input worker message type: ${type}`);
  }
});

function processInput(input: any) {
  return {
    processed: true,
    timestamp: Date.now(),
    input
  };
}

function validateInput(input: any): boolean {
  return input != null && input !== '';
}

export {};