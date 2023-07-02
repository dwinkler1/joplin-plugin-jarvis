import joplin from 'api';
import { JarvisSettings } from './settings';

// get the next response for a chat formatted *input prompt* from a *chat model*
export async function query_chat(prompt: Array<{role: string; content: string;}>,
    api_key: string, model: string, temperature: number, top_p: number,
    frequency_penalty: number, presence_penalty: number): Promise<string> {

  const url = 'https://api.openai.com/v1/chat/completions';
  const params = {
    messages: prompt,
    model: model,
    temperature: temperature,
    top_p: top_p,
    frequency_penalty: frequency_penalty,
    presence_penalty: presence_penalty,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + api_key,
    },
    body: JSON.stringify(params),
  });
  const data = await response.json();

  // output response
  if (data.hasOwnProperty('choices') && data.choices[0].message.content) {
    return data.choices[0].message.content;
  }

  // display error message
  const errorHandler = await joplin.views.dialogs.showMessageBox(
    `Error: ${data.error.message}\nPress OK to retry.`
    );

  // cancel button
  if (errorHandler === 1) {
    return '';
  }

  // find all numbers in error message
  const token_limits = [...data.error.message.matchAll(/([0-9]+)/g)];

  // truncate prompt
  if ((token_limits !== null) &&
      (data.error.message.includes('reduce'))) {

    // truncate, and leave some room for a response
    const token_ratio = 0.8 * parseInt(token_limits[0][0]) / parseInt(token_limits[1][0]);
    prompt = select_messages(prompt, token_ratio);
  }

  // retry
  return await query_chat(prompt, api_key, model, temperature, top_p,
    frequency_penalty, presence_penalty);
}

// get the next response for a completion for *arbitrary string prompt* from a any model
export async function query_completion(prompt: string, api_key: string,
    model: string, max_tokens: number, temperature: number, top_p: number,
    frequency_penalty: number, presence_penalty: number): Promise<string> {

  let url = '';
  let params: any = {
    model: model,
    temperature: temperature,
    top_p: top_p,
    frequency_penalty: frequency_penalty,
    presence_penalty: presence_penalty,
  }

  const is_chat_model = model.includes('gpt-3.5') || model.includes('gpt-4');

  if (is_chat_model) {
    // use a chat model for text completion
    url = 'https://api.openai.com/v1/chat/completions';
    params = {...params,
      messages: [
        {role: 'system', content: 'You are Jarvis, the helpful assistant.'},
        {role: 'user', content: prompt}
      ],
    };
  } else {
    url = 'https://api.openai.com/v1/completions';
    params = {...params,
      prompt: prompt,
      max_tokens: max_tokens,
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + api_key,
    },
    body: JSON.stringify(params),
  });
  const data = await response.json();

  // output completion
  if (data.hasOwnProperty('choices') && (data.choices[0].text)) {
    return data.choices[0].text;
  }
  if (data.hasOwnProperty('choices') && data.choices[0].message.content) {
    return data.choices[0].message.content;
  }

  // display error message
  const errorHandler = await joplin.views.dialogs.showMessageBox(
    `Error: ${data.error.message}\nPress OK to retry.`
    );

  // cancel button
  if (errorHandler === 1) {
    return '';
  }

  // find all numbers in error message
  const token_limits = [...data.error.message.matchAll(/([0-9]+)/g)];

  // truncate text
  if ((token_limits !== null) &&
      (data.error.message.includes('reduce'))) {

    // truncate, and leave some room for a response
    const token_ratio = 0.8 * parseInt(token_limits[0][0]) / parseInt(token_limits[1][0]);
    const new_length = Math.floor(token_ratio * prompt.length);
    if (is_chat_model) {
      // take last tokens
      prompt = prompt.substring(prompt.length - new_length);
    } else {
      // take first tokens
      prompt = prompt.substring(0, new_length);
    }
  }

  // retry
  return await query_completion(prompt, api_key, model, max_tokens,
    temperature, top_p, frequency_penalty, presence_penalty);
}

export async function query_embedding(input: string, model: string, api_key: string): Promise<Float32Array> {
  const responseParams = {
    input: input,
    model: model,
  }
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + api_key,
    },
    body: JSON.stringify(responseParams),
  });
  const data = await response.json();

  // handle errors
  if (data.hasOwnProperty('error')) {
    const errorHandler = await joplin.views.dialogs.showMessageBox(
      `Error: ${data.error.message}\nPress OK to retry.`);
      if (errorHandler === 0) {
      // OK button
      return query_embedding(input, model, api_key);
    }
    return new Float32Array();
  }
  let vec = new Float32Array(data.data[0].embedding);

  // normalize the vector
  const norm = Math.sqrt(vec.map((x) => x * x).reduce((a, b) => a + b, 0));
  vec = vec.map((x) => x / norm);

  return vec;
}

export async function query_edit(input: string, instruction: string, settings: JarvisSettings): Promise<string> {
  const responseParams = {
    input: input,
    instruction: instruction,
    model: 'text-davinci-edit-001',
    temperature: settings.temperature,
    top_p: settings.top_p,
  }
  const response = await fetch('https://api.openai.com/v1/edits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + settings.openai_api_key,
    },
    body: JSON.stringify(responseParams),
  });
  const data = await response.json();

  // handle errors
  if (data.choices === undefined) {
    await joplin.views.dialogs.showMessageBox('Error:' + data.error.message);
    return '';
  }
  return data.choices[0].text;
}

// returns the last messages up to a fraction of the total length
function select_messages(
    messages: Array<{ role: string; content: string; }>, fraction: number) {

  let result = [];
  let partial_length = 0;
  const total_length = messages.reduce((acc, message) => acc + message.content.length, 0);

  for (let i = messages.length - 1; i > 0; i--) {
    const { content } = messages[i];
    const this_length = content.length;

    if (partial_length + this_length <= fraction * total_length) {
      result.unshift(messages[i]);
      partial_length += this_length;
    } else {
      break;
    }
  }
  result.unshift(messages[0]);  // message 0 is always the system message

  // if empty, return the last message
  if (result.length == 0) {
    const last_msg = messages[messages.length - 1];
    result.push({ role: last_msg.role, content: last_msg.content });
  }

  console.log(result);
  return result;
}
