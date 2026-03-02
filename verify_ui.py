from playwright.sync_api import sync_playwright

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Because we are running pure UI and the main Electron process isn't providing `require('electron')`,
        # the Vue app might crash if we just load it directly without mocking it. Let's mock window.require.
        context = browser.new_context()
        context.add_init_script("""
            window.require = function(moduleName) {
                if (moduleName === 'electron') {
                    return {
                        ipcRenderer: {
                            invoke: async (channel, ...args) => {
                                if (channel === 'get-accounts') {
                                    return [
                                        { id: 'acc_1', name: '测试账号 A', status: 'offline', duration: 0, streamType: 'rtmp' },
                                        { id: 'acc_2', name: '测试账号 B', status: 'streaming', duration: 120, streamType: 'ffmpeg' }
                                    ];
                                }
                                return { success: true };
                            },
                            on: () => {},
                            removeAllListeners: () => {}
                        }
                    };
                }
                throw new Error('Cannot require ' + moduleName);
            };
        """)

        page = context.new_page()
        page.goto("http://localhost:5173")

        # Wait for rendering
        page.wait_for_selector(".app-container")
        page.wait_for_timeout(2000) # Give Vue time to mount and fetch mocked accounts

        # Take screenshot
        import os
        os.makedirs('/home/jules/verification', exist_ok=True)
        screenshot_path = '/home/jules/verification/ui_screenshot.png'
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot saved to {screenshot_path}")
        browser.close()

if __name__ == "__main__":
    verify_ui()
