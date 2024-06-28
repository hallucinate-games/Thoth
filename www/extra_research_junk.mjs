//this can't be an import statement because reasons?
//(https://github.com/electron/electron/issues/42439#issuecomment-2197634169)
const fsp = window.require?require('fs/promises'):undefined

const gen_model_table = async () => {
  const model_infos = await ollama.tags().then(({models}) => Promise.all(models.map(({model}) => ollama.show({model}).then(d => Object.assign(d,{model})))))
  const header = 'name,size,quant,ctx'.split(',')
  const header_md = header.join('|') + '\n' + header.map(_=>'---').join('|') + '\n'
  const model_table = header_md + model_infos.map(m => {
    const {model, model_info, details} = m
    const ctx_l = Object.entries(model_info).filter(([k]) => k.match(/context_length/))
    const {parameter_size, quantization_level} = details
    return `|${model}|${parameter_size}|${quantization_level}|${ctx_l[0][1]}|`
  }).join('\n')
  notes.innerHTML = barked.parse(model_table)
}

Object.assign(window, {fsp, gen_model_table})

export default {}
