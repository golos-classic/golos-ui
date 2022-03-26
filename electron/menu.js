const { BrowserWindow, shell, Menu, ipcMain } = require('electron')

const { createContextMenu } = require('./context_menu')

function initMenu(appUrl, httpsUrl, appSet, full = true) {
    let template = [
        {
            label: 'Обновить',
            role: 'forceReload'
        },
        {
            role: 'help',
            label: 'Помощь',
            submenu: [
                {
                    label: 'Сообщить о проблеме',
                    click: () => {
                        shell.openExternal('https://golos.chatbro.com')
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Открыть логи',
                    click: (menu, win) => { // Used instead of role, because works even if devtools are disconnected
                        win.toggleDevTools()
                    }
                },
                {
                    label: 'GOLOS Blogs ' + appSet.app_version,
                    enabled: false,
                }
            ]
        },
    ]
    if (full)
    	template = [
            {
                label: '< Назад',
                click: (item, win, e) => {
                    win.webContents.goBack()
                }
            },
            {
                label: 'Вперед >',
                click: (item, win, e) => {
                    win.webContents.goForward()
                }
            },
            {
                label: 'Перейти',
                click: (item, win, e) => {
                    let url = win.webContents.getURL() || ''
                    url = encodeURI(url)
                    url = url.replace(appUrl, httpsUrl)
                    const gotoURL = new BrowserWindow({
                        parent: win,
                        modal: true,
                        resizable: false,
                        width: 900,
                        height: 120,
                        useContentSize: true,
                        webPreferences: {
                            preload: __dirname + '/settings_preload.js'
                        }
                    })
                    ipcMain.removeAllListeners('load-url')
                    ipcMain.once('load-url', async (e, url) => {
                        win.webContents.send('router-push', url)
                    })
                    createContextMenu(gotoURL)
                    gotoURL.loadURL(appUrl + '/__app_goto_url?' + url)
                }
            },
            template[0], // Обновить
            {
                label: 'Настройки',
                click: (item, win, e) => {
                    const settings = new BrowserWindow({
                        parent: win,
                        modal: true,
                        resizable: false,
                        width: 600,
                        height: 475,
                        webPreferences: {
                            preload: __dirname + '/settings_preload.js'
                        }
                    })
                    settings.loadURL(appUrl + '/__app_settings')
                }
            },
            template[1], // Помощь
        ]
    const menu = Menu.buildFromTemplate(template)
    return menu
}

module.exports = {
    initMenu
}
