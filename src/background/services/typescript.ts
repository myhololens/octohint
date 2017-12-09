import * as ts from 'typescript'
import { MultiFileService } from './base'
import * as libsArr from '../../libs.js'
// import TS_LIB from '../../ts-lib'

function getFullLibName(name: string) {
  return `/node_modules/@types/${name}/index.d.ts`
}

// FIXME: Very slow when click type `string`
// TODO: Files timeout
export default class TSService extends MultiFileService {
  static defaultLib = ts.ScriptSnapshot.fromString(window.TS_LIB)
  static defaultLibName = '//lib.d.ts'
  static defaultLibs = {
    ...libsArr.reduce((obj: { [key: string]: null }, name: string) => {
      obj[name] = null
      return obj
    }, {}),
  }

  static preloadedTypes = [
    // { name: 'jquery', content: require('raw-loader!@types/jquery/index.d.ts') },
    { name: 'node', content: require('raw-loader!@types/node/index.d.ts') },
  ]

  private service: ts.LanguageService
  get getSourceFile() {
    return this.service.getProgram().getSourceFile
  }
  private files: {
    [fileName: string]: {
      version: number
      content: string
    }
  } = TSService.preloadedTypes.reduce(
    (result, { name, content }) => ({
      ...result,
      [getFullLibName(name)]: { version: 0, content },
    }),
    {}
  )
  // typescript: {
  //   version: 0,
  //   content: require('raw-loader!typescript/lib/typescript.d.ts'),
  // },

  constructor(fileName: string, codeUrl: string, editorConfigUrl?: string) {
    super()
    this.createService(fileName, codeUrl, editorConfigUrl)
  }

  // Use regex to get third party lib names
  getLibNamesFromCode(code: string) {
    const regs = [/[import|export].*?from\s*?['"](.*?)['"]/g, /require\(['"](.*?)['"]\)/g]
    let result: string[] = []
    for (const reg of regs) {
      const matches = code.match(reg) || []
      console.log(reg, matches)
      result = [
        ...result,
        ...matches
          .map(str => str.replace(reg, '$1'))
          .filter(name => typeof TSService.defaultLibs[name] !== 'undefined'),
      ]
    }
    return result
  }

  // Fetch type definitions from DefinitelyTyped repo
  async fetchLibCode(name: string) {
    const url = `https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/types/${name}/index.d.ts`
    const res = await fetch(url)
    if (res.ok) {
      return res.text()
    }
  }

  private updateContent(fileName: string, code: string) {
    if (this.files[fileName]) {
      if (this.files[fileName].content !== code) {
        this.files[fileName].version += 1
        this.files[fileName].content = code
      }
    } else {
      this.files[fileName] = {
        version: 0,
        content: code,
      }
    }
    console.log('Updated, current files:', this.files)
  }

  // TODO: Check if line and character are valid
  // FIXME: Always stop at debugger after upgrade to TS@2.5

  // Notice that this method is asynchronous
  async createService(fileName: string, codeUrl: string, editorConfigUrl?: string) {
    if (this.files[fileName]) return

    const code = await this.fetchCode(codeUrl, editorConfigUrl)
    this.updateContent(fileName, code)

    const libNames = this.getLibNamesFromCode(code)
    console.log('Libs:', libNames)
    const libCodes = await Promise.all(libNames.map(lib => this.fetchLibCode(lib)))
    libNames.forEach((name, i) => {
      const code = libCodes[i]
      if (code) {
        const libName = getFullLibName(name)
        this.updateContent(libName, code)
      }
    })

    // https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#incremental-build-support-using-the-language-services
    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => {
        const fileNames = Object.keys(this.files)
        // console.log('getScriptFileNames:', fileNames)
        return fileNames
      },
      getScriptVersion: fileName => {
        const version = (this.files[fileName] && this.files[fileName].version.toString()) || '0'
        // console.log('getScriptVersion:', fileName, version)
        return version
      },
      getScriptSnapshot: fileName => {
        let snapshot
        if (fileName === TSService.defaultLibName) {
          snapshot = TSService.defaultLib
        } else if (this.files[fileName]) {
          snapshot = ts.ScriptSnapshot.fromString(this.files[fileName].content)
        }
        // console.log('getScriptSnapshot', fileName)
        return snapshot
      },
      getCurrentDirectory: () => '/',
      getCompilationSettings: () => ({
        allowJs: true,
        diagnostics: true,
        // traceResolution: true,
        allowSyntheticDefaultImports: true,
        // lib: ['lib.es6.d.ts'],
      }),
      getDefaultLibFileName: () => TSService.defaultLibName,
      // getDefaultLibFileName: options => ts.getDefaultLibFileName(options),
      // getNewLine: ts.sys.newLine,
      log: console.log,
      trace: console.log,
      error: console.error,
    }

    // Create the language service files
    this.service = ts.createLanguageService(host, ts.createDocumentRegistry())
  }

  getOccurrences(file: string, line: number, character: number) {
    if (!this.service) return [] // This is necesarry because createService is asynchronous
    const instance = this.getSourceFile(file)
    const position = instance.getPositionOfLineAndCharacter(line, character)
    return (this.service.getReferencesAtPosition(file, position) || [])
      .filter(({ fileName }) => fileName === file)
      .map(reference => ({
        isWriteAccess: reference.isWriteAccess,
        range: instance.getLineAndCharacterOfPosition(reference.textSpan.start),
        width: reference.textSpan.length,
      }))
  }

  getDefinition(file: string, line: number, character: number) {
    if (!this.service) return
    const instance = this.getSourceFile(file)
    const position = instance.getPositionOfLineAndCharacter(line, character)
    const infos = this.service.getDefinitionAtPosition(file, position)
    if (infos) {
      const infosOfCurrentFile = infos.filter(info => info.fileName === file)
      if (infosOfCurrentFile.length) {
        return instance.getLineAndCharacterOfPosition(infosOfCurrentFile[0].textSpan.start)
      }
    }
  }

  getQuickInfo(file: string, line: number, character: number) {
    if (!this.service) return
    const instance = this.getSourceFile(file)
    const position = instance.getPositionOfLineAndCharacter(line, character)
    const quickInfo = this.service.getQuickInfoAtPosition(file, position)
    if (quickInfo) {
      // TODO: Colorize display parts
      return {
        info: quickInfo.displayParts,
        range: instance.getLineAndCharacterOfPosition(quickInfo.textSpan.start),
        width: quickInfo.textSpan.length,
      }
    }
  }
}
