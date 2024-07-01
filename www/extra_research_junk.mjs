//this can't be an import statement because reasons?
//(https://github.com/electron/electron/issues/42439#issuecomment-2197634169)
const fsp = window.require?require('fs/promises'):undefined

const format_bytes = bytes => {    
    const mag = Math.log10(bytes)
    if (mag < -0.2) return [Math.log2(bytes*256),'bits']
    if (mag < 3.0) return [bytes,'b']
    if (mag < 5.95) return [bytes/1024,'kb']
    if (mag < 8.95) return [bytes/(1024**2),'mb']
    if (mag < 12) return [bytes/(1024**3),'gb']
    if (mag > 12) return [bytes/(1024**4),'tb']
}

const sz_str = bytes => {
  const [size, unit] = format_bytes(bytes)
  return size.toFixed(1)+unit
}

const gen_model_table = async () => {
  const model_infos = await ollama.tags().then(({models}) => Promise.all(models.map(({model, size}) => ollama.show({model}).then(d => Object.assign(d,{model,size})))))
  const header = 'name,size,params,quant,ctx'.split(',')
  const header_md = header.join('|') + '\n' + header.map(_=>'---').join('|') + '\n'
  const model_table = header_md + model_infos.map(m => {
    const {model, model_info, details,size} = m
    const ctx_l = Object.entries(model_info).filter(([k]) => k.match(/context_length/))
    const {parameter_size, quantization_level} = details
    return `|<a href="#" onclick="ollama.model = '${model}';console.log('model set to: ${model}');">${model}</a>|${sz_str(size)}|${parameter_size}|${quantization_level}|${ctx_l[0][1]}|`
  }).join('\n')
  notes.innerHTML = barked.parse(model_table)
}

const render_doc = async () => {
  let docs = await fetch('../generated_ollama.mjs_readme.md').then(a => a.text())
  notes.innerHTML = barked.parse(docs)
}

Object.assign(window, {fsp, gen_model_table, render_doc})

export default {}
