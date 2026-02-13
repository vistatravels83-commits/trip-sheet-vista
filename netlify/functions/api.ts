export const handler = async (event: any) => {
  // Try both VITE_ and standard prefix for environment variables
  const GOOGLE_SCRIPT_URL = process.env.VITE_GOOGLE_SCRIPT_URL || process.env.GOOGLE_SCRIPT_URL;

  if (!GOOGLE_SCRIPT_URL) {
    console.error('Environment Error: GOOGLE_SCRIPT_URL is not defined.');
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Configuration Error', 
        details: 'The backend Google Script URL is not set in environment variables.' 
      }),
    };
  }

  const { httpMethod, queryStringParameters, body } = event;

  try {
    let url = GOOGLE_SCRIPT_URL;
    if (httpMethod === 'GET' && queryStringParameters) {
      const params = new URLSearchParams(queryStringParameters);
      const paramStr = params.toString();
      if (paramStr) {
        url += (url.includes('?') ? '&' : '?') + paramStr;
      }
    }

    const response = await fetch(url, {
      method: httpMethod,
      headers: {
        'Accept': 'application/json',
        ...(httpMethod === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: httpMethod === 'POST' ? body : undefined,
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type');
    let responseData;

    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        // If Google sends back HTML (like a 404 or login page), return a friendly error
        responseData = { 
          error: 'Backend Response Error', 
          details: text.includes('<!DOCTYPE html>') ? 'Google Script returned HTML instead of JSON. Check if the script is deployed as "Anyone" can access.' : text.slice(0, 500) 
        };
      }
    }

    return {
      statusCode: response.ok ? 200 : response.status,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify(responseData),
    };
  } catch (error: any) {
    console.error('Proxy Exception:', error);
    return {
      statusCode: 502,
      body: JSON.stringify({ 
        error: 'Proxy Communication Failure', 
        details: error.message 
      }),
    };
  }
};