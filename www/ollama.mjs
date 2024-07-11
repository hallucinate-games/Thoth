/**
  * ollama.mjs is a thin wrapper for the [ollama REST api](https://github.com/ollama/ollama/blob/main/docs/api.md)
  * that tries to do as little as possible while still giving the end user
  * a fair bit more to work with than just hitting this shit with fetch
  *
  * the code is all self contained and written such that it works in node and browser
 */

//internal chunkers for streaming data
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

const call_JSON_endpoint_stream = (url,Chunker=basic_chunker) => options => {
  const method = options?"POST":"GET"
  const body = options?JSON.stringify(options):undefined

  const controller = new AbortController()
  let req_opts = {
    method, headers: { 
      "Content-Type": "application/json",
      //fml this breaks CORS, i hate all web technologies
      //"Accept": "text/event-stream"
    },
    body,
    signal: controller.signal,
  }

  let req = new Promise(res => {
    fetch(url, req_opts).then(async fetch_res => {
      const chunker = Chunker(req)
      const chunks = []
      let completion_text = ''
      const decoder = new TextDecoder()
      const reader = fetch_res.body.getReader()
      let decoded_chunk = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          //lift errors into output
          if (!chunker.output.done) {
            //TODO wait how was this supposed to work and what edgecase
            //does it handle? i think this needs further investigation
            //especially when you abort something
            //Object.assign(chunker.output, chunker.output.chunks.at(-1))
          }
          res(chunker.output)
          return
        }
        decoded_chunk += decoder.decode(value)
        //TODO validate that this assumption is correct
        //we assume all chunks end with a newline
        //a chunk might be partial, in which case we have to defer
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
  req.abort = () => controller.abort()
  return req
}

const call_JSON_endpoint = (url,def_method) => options => {
  let method = def_method||(options?"POST":"GET")
  const body = options?JSON.stringify(options):undefined

  const controller = new AbortController()
  let req_opts = {
    method, headers: { 'Content-Type': 'application/json' },
    body,
    signal: controller.signal
  }
  let req = fetch(url, req_opts)
    .then(res => {
      if (res.ok) {
        return res.json().catch(a => res)
      } else {
        throw new Error(`Error ${res.status}: ${res.statusText}`)
      }
    })
  req.abort = () => controller.abort()

  return req
}

//some endpoints can be streamed, so this wraps the two callers and swaps modes
//when stream = false (stream mode works by default)
const cje_agnostic = (url,chunker) => options => {
  if (options?.stream === false) {
    return call_JSON_endpoint(url)(options)
  } else {
    return call_JSON_endpoint_stream(url,chunker)(options)
  }
}

//main interface is a closure that wraps things up and returns an object that has
//all of the api endpoints as properties
const Ollama = (url='http://localhost:11434',model='llama') => {
  const ps = () => call_JSON_endpoint(url+'/api/ps')()
  const tags = () => call_JSON_endpoint(url+'/api/tags')()
  const generate = options => {
    if (typeof options == 'string') options = {prompt:options}
    options = Object.assign({model},options)
    return cje_agnostic(url+'/api/generate',gen_chunker)(options)
  }
  const chat = options => {
    options = Object.assign({model},options)
    console.log(options)
    return cje_agnostic(url+'/api/chat',chat_chunker)(options)
  }
  const embeddings = options => {
    call_JSON_endpoint(url+'/api/embeddings')
  }
  const pull = options => {
    if (typeof options == 'string') options = {name:options}
    return cje_agnostic(url+'/api/pull')(options)
  }
  const push = cje_agnostic(url+'/api/push')
  const delete_ = options => {
    if (typeof options == 'string') options = {name:options}
    return call_JSON_endpoint(url+'/api/delete', 'DELETE')(options)
  }
  const show = options => {
    if (typeof options == 'string') options = {name:options}
    return call_JSON_endpoint(url+'/api/show')(Object.assign({name:model},options))
  }

  const create = cje_agnostic(url+'/api/create')
  const copy = call_JSON_endpoint(url+'/api/copy')
  
  return {
    //these two endpoints don't take any params and return {models:[...]}
    //like ps in linux, lists models in ram 
    ps, 
    //confusingly named, but like ls, lists available models
    tags, 

    //generate is overloaded so that you can just pass it a string that will
    //get interpreted as a prompt using the default model if it's not passed
    //and object, and if it's passed an object without a model name it will inject
    //the default
    generate, 
    //also gets the default model injected into the params if none is included
    chat,

    //show will use the default model if none is passed, and is also overloaded
    //and can just take a modelname as a string rather than consuming an object
    show, 

    //pull and delete also have the string overload but no default
    pull,

    //delete is a reserved word so it has to be remapped from delete_
    delete:delete_,

    //gets the embedding for a string, overloaded (can take string or object)
    //and gets default model if none is passed
    embeddings,

    //see api docs
    create, copy, 

    //ollama.model has a getter/setter to manage the default model included with 
    //calls to the api, which expects an explicit model with each call, but the
    //wrapper instance can have a default to make it easier to work with`
    get model() {
      return model
    },
    set model(m_name) {
      model = m_name
    },
  }
}

export default Ollama
