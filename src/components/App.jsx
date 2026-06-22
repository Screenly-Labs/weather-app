import { jsx } from 'hono/jsx'
import Layout from './Layout'
import Header from './Header'
import Footer from './Footer'
import { sentryIds, gaIds } from '../constants'

const App = (props) => {
  const { env, lat, lng } = props
  const sentryId = sentryIds[env]
  const gaId = gaIds[env]
  return (
    <Layout sentryId={sentryId} gaId={gaId}>
      <div class='content playing'>
        <div class='weather-fx' aria-hidden='true'></div>
        <Header />
        <Footer />
      </div>
      <span id='location-data' data-location-lat={lat} data-location-lng={lng} />
    </Layout>
  )
}

export default App
