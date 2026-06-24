import Layout from './Layout'
import Header from './Header'
import Footer from './Footer'
import { sentryIds, gaIds } from '../constants'

// Fixed pool of particle elements. They are pure static markup; CSS animates
// them (rain / snow / stars) per body[data-cond], with per-:nth-child seeds
// providing the randomness. Count tuned for rain density.
const FX_PARTICLES = 30

const App = (props) => {
  const { env, lat, lng } = props
  const sentryId = sentryIds[env]
  const gaId = gaIds[env]
  return (
    <Layout sentryId={sentryId} gaId={gaId}>
      <div class='content playing'>
        <div class='weather-fx' aria-hidden='true'>
          {Array.from({ length: FX_PARTICLES }).map(() => <span class='fx-p' />)}
        </div>
        <Header />
        <Footer />
      </div>
      <span id='location-data' data-location-lat={lat} data-location-lng={lng} />
    </Layout>
  )
}

export default App
