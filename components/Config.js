import YAML from "yaml"
import fs from "fs"
import path from "path"

const _path = process.cwd()
const plugin = "help-image-plugin"

export default class Config {
  static getConfig(name) {
    const file = path.join(_path, "plugins", plugin, "config", "config", `${name}.yaml`)
    if (!fs.existsSync(file)) {
      this.copyDefault(name)
    }
    return YAML.parse(fs.readFileSync(file, "utf8"))
  }

  static setConfig(name, data) {
    const dir = path.join(_path, "plugins", plugin, "config", "config")
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const file = path.join(dir, `${name}.yaml`)
    fs.writeFileSync(file, YAML.stringify(data))
  }

  static copyDefault(name) {
    const defaultFile = path.join(_path, "plugins", plugin, "config", "default_config", `${name}.yaml`)
    const configDir = path.join(_path, "plugins", plugin, "config", "config")
    const configFile = path.join(configDir, `${name}.yaml`)
    if (fs.existsSync(defaultFile)) {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }
      fs.copyFileSync(defaultFile, configFile)
    }
  }

  static getImageDir() {
    const dir = path.join(_path, "plugins", plugin, "resources", "images")
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  static getImageList() {
    const dir = this.getImageDir()
    const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f))
    files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    return files.map(f => path.join(dir, f))
  }

  static deleteImage(index) {
    const imageList = this.getImageList()
    if (index < 1 || index > imageList.length) return false
    const filepath = imageList[index - 1]
    const filename = path.basename(filepath)
    fs.unlinkSync(filepath)
    this.deleteNoteByFilename(filename)
    return true
  }

  static saveImage(buffer, ext = "png") {
    const dir = this.getImageDir()
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const filepath = path.join(dir, filename)
    fs.writeFileSync(filepath, buffer)
    return filepath
  }

  static getNotesFile() {
    return path.join(_path, "plugins", plugin, "config", "config", "notes.json")
  }

  static getAllNotes() {
    const file = this.getNotesFile()
    if (!fs.existsSync(file)) return {}
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"))
    } catch {
      return {}
    }
  }

  static setNote(index, note) {
    const imageList = this.getImageList()
    if (index < 1 || index > imageList.length) return false
    const filename = path.basename(imageList[index - 1])
    const notes = this.getAllNotes()
    notes[filename] = note
    const file = this.getNotesFile()
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(file, JSON.stringify(notes, null, 2))
    return true
  }

  static getNote(index) {
    const imageList = this.getImageList()
    if (index < 1 || index > imageList.length) return ""
    const filename = path.basename(imageList[index - 1])
    const notes = this.getAllNotes()
    return notes[filename] || ""
  }

  static setNoteByFilename(filename, note) {
    const notes = this.getAllNotes()
    notes[filename] = note
    const file = this.getNotesFile()
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(file, JSON.stringify(notes, null, 2))
    return true
  }

  static deleteNoteByFilename(filename) {
    const notes = this.getAllNotes()
    if (notes[filename]) {
      delete notes[filename]
      const file = this.getNotesFile()
      fs.writeFileSync(file, JSON.stringify(notes, null, 2))
    }
  }

  static saveAllNotes(notes) {
    const file = this.getNotesFile()
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(file, JSON.stringify(notes, null, 2))
  }
}
