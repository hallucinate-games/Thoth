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

//main interface is a closure that wraps things up and returns an object that has
//all of the api endpoints as properties
const Aineko = (url='http://localhost:5000') => {
  const add_dir = dir_to_add => call_JSON_endpoint(url+'/add-dir', 'POST')({dir_to_add})

  //this is the unfortunate reality of debugging arrow functions
  const inject_citations = (
    {
      rag_response_text,
      text_references    
    }
  ) => {
    const cleaned_tr = text_references.map(({
      file_path, begin_chunk_idx, end_chunk_idx,
    }) => ({
      file_path, begin_chunk_idx, end_chunk_idx,
    }))
    return call_JSON_endpoint(url+'/inject_citations')({
      rag_response_text,
      text_references:cleaned_tr    
    })
  }

  const query = query => call_JSON_endpoint(url+'/query', 'POST')({query})
  //TODO urlencode
  const file = file => fetch(url+`/file/${file}`)

  return {
    add_dir,
    query,
    inject_citations,
    file,
  }
}

export default Aineko
