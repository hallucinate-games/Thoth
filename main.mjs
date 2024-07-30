import { app, BrowserWindow, globalShortcut } from 'electron'
import path from 'path'

let main_window

let close_toggle = {}

process.stdout.write(
  String.fromCharCode(27) + "]0;" + "SHODAN NODE" + String.fromCharCode(7)
)

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
  create_window()

  globalShortcut.register('CommandOrControl+Shift+N', toggle_window)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) create_window()
  })
})

app.on('window-all-closed', () => {
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
