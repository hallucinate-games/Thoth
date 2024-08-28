import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import stream from 'stream'
import yauzl from 'yauzl'

const pipeline = promisify(stream.pipeline)

const update_progress = (message) => {
  process.stdout.clearLine()
  process.stdout.cursorTo(0)
  process.stdout.write(message)
}

const download_and_unzip = async (url, outputPath) => {
  const tempPath = path.join(outputPath, 'ollama.zip')

  try {
    // Download the file
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const contentLength = response.headers.get('Content-Length')
    let downloadedBytes = 0

    const fileStream = fs.createWriteStream(tempPath)
    const reader = response.body.getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fileStream.write(value)
      downloadedBytes += value.length
      if (contentLength) {
        const percentCompleted = Math.round((downloadedBytes * 100) / contentLength)
        update_progress(`Download progress: ${percentCompleted}%`)
      }
    }

    fileStream.end()
    await new Promise(resolve => fileStream.on('finish', resolve))
    console.log('\nDownload completed')

    // Unzip the file
    return new Promise((resolve, reject) => {
      yauzl.open(tempPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err)

        let totalEntries = zipfile.entryCount
        let processedEntries = 0

        zipfile.on('entry', (entry) => {
          const entryPath = path.join(outputPath, entry.fileName)
          if (/\/$/.test(entry.fileName)) {
            // Directory entry
            fs.mkdirSync(entryPath, { recursive: true })
            zipfile.readEntry()
          } else {
            // File entry
            // it seems like some file entries that are nested come before the
            // relevant directory entries, or the directory entries don't come at all?
            const dir = path.dirname(entryPath)
            //console.log('fileent! '+entry.fileName, dir)
            fs.mkdirSync(dir , { recursive: true })
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err)
              const writeStream = fs.createWriteStream(entryPath)
              readStream.pipe(writeStream)
              writeStream.on('finish', () => {
                processedEntries++
                const percentCompleted = Math.round((processedEntries * 100) / totalEntries)
                update_progress(`Unzip progress: ${percentCompleted}%`)
                zipfile.readEntry()
              })
            })
          }
        })

        zipfile.on('end', () => {
          fs.unlinkSync(tempPath)
          console.log('\nUnzip completed')
          resolve()
        })

        zipfile.readEntry()
      })
    })
  } catch (error) {
    console.error('Error:', error.message)
    throw error
  }
}

export default download_and_unzip
