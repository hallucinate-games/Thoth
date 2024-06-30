//chunkers for streaming data
//these get passed to the streaming endpoint caller in order to do additional
//processing for specific endpoints as a convenience
//TODO dry this shit out a bit maybe?
const basic_chunker = response => {
  let output = {chunks:[]}
  let process_chunk = chunk => {
    output.chunks.push(chunk)
    response?.onchunk?.(chunk)
  }
  return {output, process_chunk} 
}

const gen_chunker = response => {
  let output = {chunks:[],response:''}
  let process_chunk = chunk => {
    output.chunks.push(chunk)
    response?.onchunk?.(chunk)
    if (chunk?.response) {
      response?.ontext?.(chunk.response)
      output.response += chunk.response
    }
    if (chunk.done) {
      Object.assign(output,
        output.chunks.at(-1),
        //this is necessary because the done chunk always has an emptystring response
        {response: output.response}
      )
    }

  }
  return {output, process_chunk} 
}

const chat_chunker = response => {
  let output = {chunks:[],message:undefined}
  let process_chunk = chunk => {
    output.chunks.push(chunk)
    response?.onchunk?.(chunk)
    if (chunk?.message) {
      if (!output.message) output.message = chunk.message
      output.message.content += chunk.message.content
      //TODO this probably fucks up when we're dealing with images being returned from a model
      response?.onmessage?.(chunk.message)
      response?.ontext?.(chunk.message.content)
    }
    if (chunk.done) {
      Object.assign(
        output,
        output.chunks.at(-1),
        {message:output.message},
      )
    }

  }
  return {output, process_chunk} 
}

const call_JSON_endpoint_stream = (url,Chunker=basic_chunker) => payload => {
  const method = payload?"POST":"GET"
  const body = payload?JSON.stringify(payload):undefined
  let req_opts = {
    method, headers: { 
      "Content-Type": "application/json",
      //fml this breaks CORS, i hate all web technologies
      //"Accept": "text/event-stream"
    },
    body
  }
  let response = new Promise(res => {
    fetch(url, req_opts).then(async fetch_res => {
      const chunker = Chunker(response)
      const chunks = []
      let completion_text = ''
      const decoder = new TextDecoder()
      const reader = fetch_res.body.getReader()
      let decoded_chunk = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          //lift errors into output
          if (!chunker.output.done) Object.assign(chunker.output, chunker.output.chunks.at(-1))
          res(chunker.output)
          return
        }
        //TODO validate that this assumption is correct
        //we assume all chunks end with a newline
        //a chunk might be partial, in which case we have to defer
        decoded_chunk += decoder.decode(value)
        if (decoded_chunk.at(-1) === '\n') {
          const chunks = decoded_chunk
            .split('\n')
            .filter(a => a.length && a !== '\r')
            .map(chunk => {
              try {
                const parsed = JSON.parse(chunk)
                return parsed
              } catch (error) {
                return {error,chunk}
              }
          }).forEach(chunker.process_chunk)
          decoded_chunk = ''
        }
        //console.log(decoded_chunk)
      }})
  })
  return response
}

const call_JSON_endpoint = (url,def_method) => payload => {
    let method = def_method||(payload?"POST":"GET")
  const body = payload?JSON.stringify(payload):undefined
  let req_opts = {
    method, headers: { 'Content-Type': 'application/json' },
    body
  }
  return fetch(url, req_opts)
    .then(res => {
      if (res.ok) {
        return res.json().catch(a => res)
      } else {
        throw new Error(`Error ${res.status}: ${res.statusText}`)
      }
    })
    .catch(error => {
      console.error(`Error sending request: ${error}`)
    })
}

const cje_agnostic = (url,chunker) => payload => {
  if (payload?.stream === false) {
    return call_JSON_endpoint(url)(payload)
  } else {
    return call_JSON_endpoint_stream(url,chunker)(payload)
  }
}

const Ollama = (url='http://localhost:11434',model='llama') => {
  const ps = call_JSON_endpoint(url+'/api/ps')
  const generate = payload => {
    if (typeof payload == 'string') payload = {prompt:payload}
    payload = Object.assign({model},payload)
    return cje_agnostic(url+'/api/generate',gen_chunker)(payload)
  }
  const chat = payload => {
    payload = Object.assign({model},payload)
    console.log(payload)
    return cje_agnostic(url+'/api/chat',chat_chunker)(payload)
  }
  const create = cje_agnostic(url+'/api/create')
  const tags = call_JSON_endpoint(url+'/api/tags')
  const copy = call_JSON_endpoint(url+'/api/copy')
  const embeddings = call_JSON_endpoint(url+'/api/embeddings')
  const pull = payload => {
    if (typeof payload == 'string') payload = {name:payload}
    return cje_agnostic(url+'/api/pull')(payload)
  }
  const push = cje_agnostic(url+'/api/push')
  const delete_m = payload => {
    if (typeof payload == 'string') payload = {name:payload}
    return call_JSON_endpoint(url+'/api/pull', 'DELETE')(payload)
  }
  const show = payload => call_JSON_endpoint(url+'/api/show')(Object.assign({model},payload))
  
  return {
    embeddings,
    generate, chat,
    ps,
    create, //warn, untested, should work tho
    tags, show, pull,
    copy, delete:delete_m,
    get model() {
      return model
    },
    set model(m_name) {
      model = m_name
    },
  }
}
/*
let ollama = Ollama('http://boxxy.lan:11434','interstellarninja/hermes-2-theta-llama-3-8b:latest')

let req = ollama.chat({messages: [{role: "system", content: "You are an impish silly assistant."},{role:"user",content: "Who are you?"}]})
req.onchunk = console.log
let zz = await req

await ollama.show()
*/
export default Ollama
