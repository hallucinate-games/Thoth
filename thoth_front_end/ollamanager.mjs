import child_process from 'child_process'
import { promisify } from 'util'
import path from 'path'
import http from 'http'
import fs from 'fs/promises'
import download_and_unzip from './downloadAndUnzip.mjs'
import {version} from 'os'

const expected_version = '0.3.7' 

const exec = promisify(child_process.exec)
const nul = a => null

const get_existing_ollama = async (ollama_path = 'ollama', hostname='') => {
  let status = (await exec(`${path.resolve(ollama_path)} --version`).then(a => a.stdout))
  //console.log({status})
  ollama_path = (await 
    exec(`where ${ollama_path}`)
    .then(a => a.toString())
    .catch(a => null)
  ) || ollama_path
  let running = !status.match(/Warning: could not connect to a running Ollama instance/i)
  //TODO this is gross but needed to handle the case where ollama is running locally managed
  //on a diff port in order to not conflict with an existing ollama install
  if (!running) running = await fetch(hostname+'/api/version')
    .then(_ => true)
    .catch(_ => false)
  let version = status.match(/version is (.+?)$/mi)?.[1]
  return {running, ollama_path, version}
}

const version_info_blurb =  version => version === expected_version?
  `it is the correct version (v${expected_version})`:
  `it is *not* the expected version (expected: v${expected_version}, found: v${version})\nthis is probably fine but if there are issues set "force_local":true in \`ollama.json\` to force Thoth to download it's own copy`

//TODO think about using the API, though i really think this is fine since the whole thing
//is relying on a particular release being available and named a particular thing by the authors
let get_release_artifacts = (release_tag) => fetch(`https://github.com/ollama/ollama/releases/expanded_assets/${release_tag}`)
  .then(a => a.text())
  .then(html => [...html.matchAll(/\<.*?a.*?href="(.+?)"/gim)].map(m => {
    const github_root = 'https://github.com'
    const artifact_url = m[1]
    const filename = artifact_url.split('/').at(-1)
    return {url: github_root+artifact_url, filename}
  }))
//.catch(e => console.error(e))

const summon_ollama = async ({
  force_local,
  //force_manage,
  path:ollama_path = '../ollama/bin/ollama.exe', 
  hostname = 'http://localhost:11434' 
}) => {
  if (force_local) {
    ollama_path = '../ollama/bin/ollama.exe'
    hostname = 'http://localhost:12434'
  }
  ollama_path = path.resolve(ollama_path)
  let onprogress
  let process
  let status = {ready: false}

  let existing_ollama = await fetch(hostname+'/api/version')
    .then(a => a.json())
    .then(a => (a.running=true,a))
    .catch(a => ({}))

  if (existing_ollama.version) {
    const version_info = version_info_blurb(existing_ollama.version)
    console.log(`found running ollama server at ${hostname}\n${version_info}`)
    if (force_local) console.warn(`force_local is set to true in ollama.json but a server is already running, this is highly unusual but we'll try to roll with it`)
  } else {
    console.log('\nlooking for existing ollama installation...\n')
    existing_ollama = await get_existing_ollama(ollama_path, hostname)
      .catch(error => ({error}))
  }


  if (existing_ollama.error) {
    console.log(`ollama is not available, thoth will now attempt to install it, this may take some time`)
    const ollama_dir = '../ollama'
    await fs.mkdir(ollama_dir).catch(a => null)
    ollama_path = path.resolve('../ollama/bin/ollama.exe')
    //TODO actually implement this
    //if (!ollama_path) console.log('if you have ollama installed but NOT on PATH you may configure it\'s location by setting "path":"C:\\your_ollama_location\\ollama.exe" in `ollama.json`')
    console.log('checking github.com/ollama/ollama for binaries')
    const release = await get_release_artifacts(`v${expected_version}`)
      .then(releases => {
        //we only support windows right now
        return releases.find(({filename}) => filename.match(/windows-amd64.zip/i))
      })
      .catch(error => {
        throw `unable to reach github or some other such nonsense, this is too confusing for me, you gotta fix it yourself :(\nadditional info:${error}`
      })

    console.log(`found a suitable binary @ ${release.url}! downloading...`)
    await download_and_unzip(release.url, ollama_dir)
    existing_ollama = await get_existing_ollama(ollama_path)
      .catch(error => ({error}))
  }

  if (existing_ollama.error) throw existing_ollama.error

 //console.log({existing_ollama})

  if (existing_ollama.running) {
    //TODO actually check that the API is available here
    console.log('everything looks good, ollama is running and accessible')
  } else {
    const version_info = version_info_blurb(existing_ollama.version)
    console.log(`found ollama at ${existing_ollama.ollama_path}\n${version_info}`)
    console.log(`ollama doesn't appear to be running, starting now`)
    const env = {
      //...process.env,
      OLLAMA_HOST: '127.0.0.1:'+hostname.split(':')
      .map(a => a.trim())
      .filter(a => a)
      .at(-1)
    }
    console.log({env})
    try {
      process = child_process.spawn(`${path.resolve(ollama_path)}`, ['serve'], {env})
      console.log(ollama_path)
    } catch (e) {
      console.warn(e)
    }
    //TODO we should figure out how to listen properly here, but i'm just going
    //to throw a wait in here to fix the race condition
    //await new Promise(r => setTimeout(r,1000))
    existing_ollama = await get_existing_ollama(ollama_path, hostname)
      .catch(error => ({error}))
    if (!existing_ollama.running) throw 'did not manage to start ollama' + JSON.stringify(existing_ollama, null, 2)
    console.log(`yay, everything is working, ollama running in the background (v${existing_ollama.version})`)
  }

  return {
    version: existing_ollama.version,
    ollama_path: existing_ollama.ollama_path,
    hostname,
    //process,
    /*
    get status() {
      return status
    }
    */
  }
}

export default summon_ollama
