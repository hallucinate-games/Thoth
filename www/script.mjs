import Ollama from "./ollama.mjs"
import junk from './extra_research_junk.mjs' 
//sadly this doesn't work
//import {hostname, model} from "../ollama.json" assert { type: `json` }
const {hostname,model} = await fetch('../ollama.json').then(j => j.json())
console.log({hostname,model})

let ollama = Ollama(hostname,model)

notes.focus()

const barked = new marked.Marked(
  markedHighlight.markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang, info) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    }
  })
)

window.temp = ''

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
    return {tps, eval_sec}
} 

window.ap = {}
let generating = undefined
document.onkeydown = ({keyCode,ctrlKey}) => {
  if (generating?.abort && keyCode === 67 && ctrlKey) generating.abort()
}

notes.onkeydown = async event => {
  const {key, shiftKey} = event
  if (key === "Enter" && shiftKey) {
  } else if (key === "Enter") {
    event.preventDefault()
    console.log('completing')
    temp = notes.innerText+'\n\n'
    let req_params = Object.assign({},{prompt:temp, keep_alive: "60m"},window.ap)
    if (window.image) req_params.images = [image]
    generating = ollama.generate(req_params)
    let ihtml = barked.parse(temp)
    notes.innerHTML = ihtml+'<br>'
    move_caret_to_end(notes)
    generating.ontext = text => {
      temp += text
      let ihtml = barked.parse(temp)
      notes.innerHTML = ihtml
    }
    let res = await generating
    window.lastres = res
    console.log(calc_stats(res))
  }
}

notes.oninput = () => {
  if (temp) {
    notes.innerText = temp
    temp = ''
  }
}

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

document.addEventListener("drop", function(event) {
    event.preventDefault();
    event.stopPropagation();

    // Check if dropped item is an image
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
});

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
});


Object.assign(window, {Ollama, ollama, barked})
