# ButtonDebug (development only)

`buttonDebug.js` is installed only when Vite is running in development mode (`import.meta.env.DEV`). It is not enabled in production builds.

Open DevTools → Console and click a button. ButtonDebug can report:

- disabled / aria-disabled buttons
- missing React or DOM click handlers
- submit buttons without a form submit handler
- `pointer-events: none`
- hidden or zero-size buttons
- another element covering the button (overlay / z-index issue)
- pointer-down events that never become clicks
- runtime errors or rejected promises immediately after a click
- clicks that reached a handler but produced no visible DOM, URL, or localStorage change

Useful console commands:

```js
ButtonDebug.scan()
ButtonDebug.inspect('button.nearby-add')
ButtonDebug.last()
ButtonDebug.help()
```

The React handler check uses React's development DOM metadata, so it is intentionally a development diagnostic and not application logic.
