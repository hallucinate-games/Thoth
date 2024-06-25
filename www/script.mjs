import Ollama from "./ollama.mjs"
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

let temp = ''

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

notes.onkeydown = async event => {
  const {key, shiftKey} = event
  if (key === "Enter" && shiftKey) {
    event.preventDefault()
    console.log('completing')
    temp = notes.innerText+'\n\n'
    let req = ollama.generate(temp)
    let ihtml = barked.parse(temp)
    notes.innerHTML = ihtml+'<br>'
    move_caret_to_end(notes)
    req.ontext = text => {
      temp += text
      let ihtml = barked.parse(temp)
      notes.innerHTML = ihtml
    }
    let res = await req
    console.log(res)
  }
}

notes.oninput = () => {
  if (temp) {
    notes.innerText = temp
    temp = ''
  }
}


Object.assign(window, {Ollama})
