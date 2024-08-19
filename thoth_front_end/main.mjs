import { spawn, spawnSync } from 'child_process'
import { app, BrowserWindow, globalShortcut } from 'electron'
import path from 'path'
import fs from 'fs'

let main_window
let python_process

let close_toggle = {}

process.stdout.write(
  String.fromCharCode(27) + "]0;" + "Thoth Backend" + String.fromCharCode(7)
)

const get_or_install_python_executable = () => {
  const app_path = app.getAppPath()
  const python_executable = process.platform === 'win32' ?
    path.resolve(app_path, '../thoth_back_end/.venv/Scripts/python.exe') :
    path.resolve(app_path, '../thoth_back_end/.venv/bin/python')
  if (fs.existsSync(python_executable)) {
    console.log('Backend python installed')
    return python_executable
  } else {
    console.error(`Backend python not detected at ${python_executable}`)
    console.log('Installing backend python virtual environment...')
    const venv_path = path.resolve(app_path, '../thoth_back_end/.venv')
    var {stdout, stderr, status} = spawnSync('python', ['-m', 'venv', venv_path])
    if (status !== 0) {
      console.error(`Failed to install python virtual environment with error ${status}`)
      console.error(`Failed install stdout: ${stdout}`)
      console.error(`Failed install stderr: ${stderr}`)
      throw "Failed to install python virtual environment!"
    }
    // TODO: be smarter about detecting changes and upgrading as necessary
    console.log('Installing python requirements... this may take a while...')
    const pip_executable = process.platform === 'win32' ?
      path.resolve(app_path, '../thoth_back_end/.venv/Scripts/pip.exe') :
      path.resolve(app_path, '../thoth_back_end/.venv/bin/pip')
    const requirements_path = path.resolve(app_path, '../thoth_back_end/requirements.txt')
    var {stdout, stderr, status} = spawnSync(pip_executable, ['install', '-r', requirements_path])
    if (status !== 0) {
      console.error(`Failed to install python requirements with error ${status}`)
      console.error(`Failed requirements stdout: ${stdout}`)
      console.error(`Failed requirements stderr: ${stderr}`)
      throw "Failed to install python requirements! You will have to correct this manually."
    }
    console.log('Success! Python environment is ready to go!')
  }
  return python_executable
}

const start_python_backend = () => {
  const app_path = app.getAppPath()
  const python_executable = get_or_install_python_executable()
  const python_script = path.resolve(app_path, '../thoth_back_end/src/main.py')
  const python_script_args = ['--server']

  console.log(`Python executable: ${python_executable}`);
  console.log(`Python script: ${python_script}`);
  python_process = spawn(python_executable, [python_script, ...python_script_args]) 

  python_process.stdout.on('data', (data) => {
    console.log(`[Backend stdout]: ${data}`)
  })
  python_process.stderr.on('data', (data) => {
    console.log(`[Backend stderr]: ${data}`)
  })
  python_process.on('error', (err) => {
    console.error(`Failed to start backend process: ${err.message}`)
  })
  python_process.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`)
    // TODO: smart reboot? Need to carefully consider edge cases and looping etc.
  })
}

const create_window = () => {
  main_window = new BrowserWindow({
    width: 400,
    height: 600,
    x: -400, // Start off-screen to the left
    y: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      //preload: path.join(path.resolve(path.dirname('')), '/preload.mjs'),
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  main_window.loadFile('www/index.html')
  //main_window.webContents.openDevTools()

  //console.log(global)
  Object.assign(global, {main_window})
  //toggle_window()
}

app.whenReady().then(() => {
  start_python_backend()
  create_window()

  globalShortcut.register('CommandOrControl+Shift+N', toggle_window)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) create_window()
  })
})

app.on('window-all-closed', () => {
  if (python_process) python_process.kill()
  if (process.platform !== 'darwin') app.quit()
})

let visible = false

const toggle_window = () => {
  console.log("toggled window")
  close_toggle?.ontoggle?.(visible)
  if (visible) {
    const {width} = main_window.getBounds()
    setTimeout(
      () => main_window.setBounds({ x: -width }, true),
      100
    )
    visible = !visible
  } else {
    main_window.setBounds({ x: 0 }, true)
    main_window.focus()
    visible = !visible
  }
}
