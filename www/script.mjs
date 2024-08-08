import Ollama from "./ollama.mjs"
import Aineko from "./aineko.mjs"
import junk from './extra_research_junk.mjs' 
const { webFrame, shell } = require('electron')

// Replace 'path/to/your/file.txt' with the actual path to your file
//const filePath = 'path/to/your/file.txt'; 
//shell.openPath(filePath);

const idf = a => a
const nulf = a => null 
//sadly this doesn't work
//import {hostname, model} from "../ollama.json" assert { type: `json` }
const {hostname,model,aineko:aineko_host} = await fetch('../ollama.json').then(j => j.json())
console.log({hostname,model,aineko_host})

let ollama = Ollama(hostname,model)
let aineko = Aineko(aineko_host)

let retrival_debug_toggle = {state:true}

//notes.focus()

//TODO: fix, this has to be dumb like this because of how we're importing Marked
const marked_renderer = new marked.Marked(
  markedHighlight.markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang, info) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    }
  }),
  {
    breaks: true,
    gmf: true,
  }
)

const r_md = markdown => marked_renderer.parse(markdown)

//i don't like this
const Assistant_Completion = async (matches) => {
  if (!generating) {
    const message = Message({
      message:{
        role: 'assistant',
      },
      active: true
    })
    let retrieve = !!retrival_debug_toggle.state && matches.length
    const fs = renderer.flat_state
    const messages = fs.map(a => a.message)
    const last_msg = fs.at(-1)
    if (retrieve) {
      const match_string = matches.map(({text}={text:''}) => text).join('\n')
      console.log(match_string)
      messages.push({role:'system',content:`If applicable, use the following retrieved data to answer:
${match_string}
  `})
    }
    last_msg.child_msgs.push(message)
    last_msg.active_child = last_msg.child_msgs.length-1
    renderer.dirty = true
    generating = ollama.chat({messages, keep_alive:'60m'})
    let ct = ''
    generating.onchunk = t => {
    }
    generating.ontext = t => {
      ct += t
      let ihtml = r_md(ct)//.replaceAll('\n','  \n'))
      message.innerHTML = ihtml
      message.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      }) 
    }
    const done = await generating.catch(nulf)
    const stats = calc_stats(done)
    console.log(`generated ${stats.tokens} tkns in ${stats.eval_sec.toFixed(1)}s (${stats.tps.toFixed(1)}) tps`)
    message.message = done.message
    if (retrieve) {
      const citations = await aineko.inject_citations({rag_response_text:ct,text_references:matches})
      const cited_matches = [...new Set(citations.cited_sentences.map(a => a.text_reference_idx))]
      const cited_files = [...new Set(cited_matches.map(i => matches[i].file_path.replaceAll('\\','/')))]
      const citation_div = document.createElement('div')
      citation_div.classList.add('citations')
      citation_div.innerHTML = '<h4>Citations</h4>'
      const citation_links = cited_files.map((path,i) => {
        const filename = path.split('/').at(-1)
        const div = document.createElement('a')
        div.innerText = `[${i}] ${filename}`
        div.href = '#'
        div.onclick = () => shell.openPath(path)
        return div
      })
      citation_links.forEach(div => {
        citation_div.appendChild(div)
        citation_div.appendChild(document.createElement('br'))
      })
      message.appendChild(citation_div)
      //let hell = shell
      //debugger
      console.log(citations)
    }
    generating = false
    message.active = false
    renderer.dirty = true
  }
}

window.temp = ''

let Message = construct_opts => {
  let {message, active_child=0, child_msgs=[]} = construct_opts
  message.content = message.content || ''
  //let {role, content} = message
  const div = document.createElement('div') 
  div.classList.add('message', message.role)
  if (message.role === 'user' && !message.content) {
    console.log('making a editable msg')
    div.contentEditable = true
    let content
    div.onkeydown = async event => {
      const {key, shiftKey} = event
      if (content) {
        div.innerHTML = `<p>${content}</p>`
        content = false
        div.contentEditable = true
        move_caret_to_end(div)
      } 
      if (key === "Tab" && !shiftKey && !content) {
        content = div.innerText
        let ihtml = r_md(content) 
        div.innerHTML = ihtml
        div.contentEditable = true
        move_caret_to_end(div)
      } else if (key === "Enter" && !shiftKey) {
        event.preventDefault()
        const lastmsg = renderer.flat_state.at(-1)
        lastmsg.child_msgs.push(div)
        div.active = false
        div.contentEditable = false

        message.content = div.innerText 
        //TODO this maybe isn't good or causes edgecases
        //but also trailing whitespace causes edgecases so i just kill it
          .split('\n').map(a => a.replace(/\s+$/, '')).join('\n')
        console.log('completion query')
        console.log(message.content)
        let ihtml = r_md(message.content)
        div.innerHTML = ihtml
        renderer.dirty = true
        //const matches = [{text:"mebbo is the cutest"}]
        //TODO this is probably not the right place for this to happen
        const matches = (await aineko.query(message.content).then(a => a.query_results).catch(_=>[]))
          .filter(a => a.distance < 1.1)
        console.log('matches:')
        console.log(matches)
        Assistant_Completion(matches)
      }
    }
    div.onpaste = event => {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      const processed_text = text
        .split('\n').map(a => a.replace(/\s+$/, '')).join('\n')
        .replaceAll('\n','<br>')
      document.execCommand("insertHTML", false, processed_text);
    }
  }
  div.innerHTML = r_md(message.content) || '<p><br></p>'

  Object.assign(div, construct_opts, {
    get child_msgs() {
      return child_msgs
    },
    get active_child() {
      return active_child 
    },
    set active_child(c) {
      active_child = c
    }
  })
  return div
}

//this is for testing only, don't actually start with a greeting
const greeting_message = {
  role: 'assistant',
  content: 'Hey, what would you like help with?',
}

const empty_user_msg = () => Message({message: {
  role:'user',
}})

let init_state = Message({message:greeting_message})

const Renderer = (inital_state, root) => {
  let state = inital_state
  let dirty = true

  const flatten_state = (state, return_array=[]) => {
    const root = return_array.length === 0
    return_array.push(state)
    if (state.child_msgs?.length) {
      const active_child = state.child_msgs[state.active_child]
      if (active_child) flatten_state(active_child, return_array)
    }
    return return_array
  }

  const render = () => {
    const flat_state = flatten_state(state)

    Array.from({length:Math.max(flat_state.length, root.children.length)},(_,i) => {
      const child = root.children[i]
      const target_state = flat_state[i]
      // build an array of transactions so that when we mutate the children we don't lose track
      if (target_state === child) return () => console.log('nop')
      if (!child) return () => root.appendChild(target_state)
      if (!target_state) return () => child?.remove()
      console.log('replacing')
      return () => child.replaceWith(target_state)
    }).forEach(fn => {
      fn()
    })

    const last_child = root.lastChild

    if (
      last_child.message.role !== 'user' &&
      !last_child.active
    ) {
      const eum = empty_user_msg()
      root.appendChild(eum)
      eum.scrollIntoView({ behavior: 'smooth' })
      eum.focus()
    }

    dirty = false
  }

  const call = () => dirty?render():null

  return {
    render,
    call,
    get state() {
      return state
    },
    get flat_state() {
      return flatten_state(state)
    },
    get dirty() {
      return dirty
    },
    set dirty(v) {
      return dirty = !!(v)
    },
  }
}

const renderer = Renderer(init_state, document.getElementById('conversation'))

//renderer.state.child_msgs.push(Message({message:greeting_message}))
//renderer.flat_state.at(-1).child_msgs.push(Message({message:greeting_message}))
renderer.dirty = true
const on_frame = t => {
  renderer.call(t)
  requestAnimationFrame(on_frame)
}
on_frame(0)


const move_caret_to_end = element => {
  //https://stackoverflow.com/questions/1125292/how-to-move-the-cursor-to-the-end-of-a-contenteditable-entity/3866442#3866442
  //actually sooo dumb that this is the way
  const range = document.createRange()//Create a range (a range is a like the selection but invisible)
  range.selectNodeContents(element)//Select the entire contents of the element with the range
  range.collapse(false)//collapse the range to the end point. false means collapse to end rather than the start
  const selection = window.getSelection()//get the selection object (allows you to change selection)
  selection.removeAllRanges()//remove any selections already made
  selection.addRange(range)
}

//window.close_toggle.ontoggle = console.log
//
const calc_stats = res => {
  const {eval_count, eval_duration} = res
  const eval_sec = eval_duration / 10**9
  const tps = eval_count/eval_sec
  return {tps, eval_sec, tokens:eval_count}
} 

window.ap = {}
let generating = undefined
document.onkeydown = ({keyCode,ctrlKey}) => {
  if (generating?.abort && keyCode === 67 && ctrlKey) generating.abort()
}

// Define a new function to handle the actions when the enter key is pressed
const handleEnterKeyPress = async (event, notes) => {
  event.preventDefault()
  console.log('completing')
  let temp = notes.innerText+'\n\n'
  console.log(notes.innerText)
  let req_params = Object.assign({},{prompt:temp, keep_alive: "60m"},window.ap)
  if (window.image) req_params.images = [image]
  generating = ollama.generate(req_params)
  let ihtml = r_md(temp)
  notes.innerHTML = ihtml+'<br>'
  move_caret_to_end(notes)
  generating.ontext = text => {
    temp += text
    let ihtml = r_md(temp)
    notes.innerHTML = ihtml
  }
  const res = await generating.catch()
  window.lastres = res
  console.log(calc_stats(res))
}

/*
notes.onkeydown = async event => {
  const {key, shiftkey} = event
  if (key === "Enter" && !shiftkey) {
    // call the new function here
    await handlEenterKeypress(event, notes)
  }
// additional condition handling can be added here if needed
}

notes.oninput = () => {
  if (temp) {
    notes.innerText = temp
    temp = ''
  }
}
*/



const fit_to_bounds = ({width: iwidth, height: iheight}, {width: bwidth, height: bheight}) => {
  const iratio = iwidth / iheight
  const bratio = bwidth / bheight

  console.log({bwidth,bheight,iwidth,iheight})

  let width, height

  if (iratio > bratio) {
    width = bwidth
    height = bwidth / iratio
  } else {
    height = bheight
    width = bheight * iratio
  }

  return { width, height }
}

const img_to_blob = async (img, options) => {
  const {
    filetype='webp',
    quality=0.8,
    width=img.naturalWidth,
    height=img.naturalHeight
  } = options


  const mime = 'image/'+filetype.toLowerCase()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  canvas.width = width
  canvas.height = height

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return new Promise(resolve => canvas.toBlob(resolve, mime, quality))
}

const blob_to_b64 = (blob) => {
  return new Promise((res, _) => {
    const reader = new FileReader()
    reader.onloadend = () => res(reader.result)
    reader.readAsDataURL(blob)
  })
}

window.image = undefined

document.addEventListener("dragover", function(event) {
  event.preventDefault();
})
document.addEventListener("drop", function(event) {
  event.preventDefault()
  event.stopPropagation()

  if (
    event?.dataTransfer?.files?.[0] &&
    event.dataTransfer.files[0].type === "" 
  ) {
    let {path} = event.dataTransfer.files[0]
    path = path.replaceAll('\\','/')
    console.log(`adding ${path} to aineko`)

    aineko.add_dir(path)
      .then(a => console.log(`added ${path} to aineko successfully`))
      .catch(e => console.error(`attempt to add ${path} to aineko failed with:`, e))
  }

  // Check if dropped item is an image
  /*
  const droppedItems = event.dataTransfer.items;
  for (let i = 0; i < droppedItems.length; i++) {
    const item = droppedItems[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const imageDataUrl = event.target.result;
        const img = document.createElement('img')
        img.src = imageDataUrl
//document.querySelector('#notes').innerHTML += `<img src="${imageDataUrl}" />`;
        document.querySelector('#notes').appendChild(img)
        const {width,height} = fit_to_bounds(
          {width:img.naturalWidth,height:img.naturalHeight}, 
          {width:1024,height:1024}
        )
        window.image = img_to_blob(img, {
          filetype: 'png',
          width, height
        })
      };
      reader.readAsDataURL(item.getAsFile());
    }
  }
  */
})

/*
document.addEventListener("paste", function(event) {
  //TODO this breaks normal paste bro

  // Check if pasted content is an image
  const clipboardItems = event.clipboardData.items || event.originalEvent.clipboardData.items;
  for (let i = 0; i < clipboardItems.length; i++) {
    const item = clipboardItems[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      event.preventDefault();
      event.stopPropagation();
      const reader = new FileReader();
      reader.onload = function(event) {
        const imageDataUrl = event.target.result;
        const img = document.createElement('img')
        img.src = imageDataUrl
        //document.querySelector('#notes').innerHTML += `<img src="${imageDataUrl}" />`;
        document.querySelector('#notes').appendChild(img)
        img.onload = async () => {
          const {width,height} = fit_to_bounds(
            {width:img.naturalWidth,height:img.naturalHeight}, 
            {width:1024,height:1024}
          )
          console.log('wtf',img,width,height)
          const imbl =  await img_to_blob(img, {
            filetype: 'png',
            width, height
          })
          window.image =  await blob_to_b64(imbl)
          window.image = window.image.slice(22)
        }
      };
      reader.readAsDataURL(item.getAsFile());
    }
  }
})
*/


Object.assign(window, {webFrame, shell, r_md, Ollama, ollama, aineko, renderer, retrival_debug_toggle})
