import { html } from 'hono/html'

const Footer = (props) => html`
  <div class="midrow">
    <section class="hero">
      <div class="weather-condition anim" style="--d: 260ms">
        <img id="current-weather-icon" alt="" width="100" height="100" />
        <span id="current-weather-status"></span>
      </div>
      <div class="temperature">
        <span id="current-temp" class="anim" style="--d: 200ms"></span>
        <span class="t-deg anim" style="--d: 320ms">°</span>
        <span id="current-temp-scale" class="anim" style="--d: 380ms"></span>
      </div>
      <div class="detail anim" id="detail" style="--d: 460ms"></div>
    </section>

    <a
      class="brand"
      href="https://www.screenly.io"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Screenly - opens in a new tab"
    >
      <img src="/static/images/screenly-logo.svg?v=${props.v}" alt="Screenly" />
    </a>
  </div>

  <footer id="weather-item-list"></footer>

  <div class="weather-item dummy-node">
    <span class="item-time"></span>
    <img class="item-icon" alt="" width="100" height="100" />
    <span class="item-temp-degree"><span class="item-temp"></span><sup>°</sup></span>
  </div>
  `

export default Footer
