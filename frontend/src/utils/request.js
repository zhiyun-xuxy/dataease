import axios from 'axios'
// import { MessageBox, Message } from 'element-ui'
import store from '@/store'
import { $alert, $error } from './message'
import { getToken } from '@/utils/auth'
import Config from '@/settings'
import i18n from '@/lang'
import { tryShowLoading, tryHideLoading } from './loading'
import { getLinkToken, setLinkToken } from '@/utils/auth'
// import router from '@/router'

const TokenKey = Config.TokenKey
const RefreshTokenKey = Config.RefreshTokenKey
const LinkTokenKey = Config.LinkTokenKey
// create an axios instance
const service = axios.create({
  baseURL: process.env.VUE_APP_BASE_API, // url = base url + request url
  // withCredentials: true, // send cookies when cross-domain requests
  timeout: 0 // request timeout
})

// request interceptor
service.interceptors.request.use(
  config => {
    // do something before request is sent

    if (store.getters.token) {
      // let each request carry token
      // ['X-Token'] is a custom headers key
      // please modify it according to the actual situation
      config.headers[TokenKey] = getToken()
    }
    let linkToken = null
    if ((linkToken = getLinkToken()) !== null) {
      config.headers[LinkTokenKey] = linkToken
    }

    if (store.getters.language) {
      config.headers['Accept-Language'] = store.getters.language
    }
    // 增加loading

    config.loading && tryShowLoading(store.getters.currentPath)

    return config
  },
  error => {
    error.config.loading && tryHideLoading(store.getters.currentPath)
    // do something with request error
    return Promise.reject(error)
  }
)

const checkAuth = response => {
  // 请根据实际需求修改

  if (response.headers['authentication-status'] === 'login_expire') {
    const message = i18n.t('login.expires')
    store.dispatch('user/setLoginMsg', message)
    $alert(message, () => {
      store.dispatch('user/logout').then(() => {
        location.reload()
      })
    })
  }

  if (response.headers['authentication-status'] === 'invalid' || response.status === 401) {
    const message = i18n.t('login.tokenError')
    $alert(message, () => {
      store.dispatch('user/logout').then(() => {
        location.reload()
      })
    })
  }
  // token到期后自动续命 刷新token
  if (response.headers[RefreshTokenKey]) {
    const refreshToken = response.headers[RefreshTokenKey]
    store.dispatch('user/refreshToken', refreshToken)
  }

  if (response.headers[LinkTokenKey.toLocaleLowerCase()]) {
    const linkToken = response.headers[LinkTokenKey.toLocaleLowerCase()]
    setLinkToken(linkToken)
  }
}

const checkPermission = response => {
  // 请根据实际需求修改
  if (response.status === 404) {
    location.href = '/404'
  }
  if (response.status === 401) {
    location.href = '/401'
  }
}

// response interceptor
/**
service.interceptors.response.use(
  response => {
    const res = response.data

    // if the custom code is not 20000, it is judged as an error.
    if (res.code !== 20000) {
      Message({
        message: res.message || 'Error',
        type: 'error',
        duration: 5 * 1000
      })

      // 50008: Illegal token; 50012: Other clients logged in; 50014: Token expired;
      if (res.code === 50008 || res.code === 50012 || res.code === 50014) {
        // to re-login
        MessageBox.confirm('You have been logged out, you can cancel to stay on this page, or log in again', 'Confirm logout', {
          confirmButtonText: 'Re-Login',
          cancelButtonText: 'Cancel',
          type: 'warning'
        }).then(() => {
          store.dispatch('user/resetToken').then(() => {
            location.reload()
          })
        })
      }
      return Promise.reject(new Error(res.message || 'Error'))
    } else {
      return res
    }
  },
  error => {
    console.log('err' + error) // for debug
    Message({
      message: error.message,
      type: 'error',
      duration: 5 * 1000
    })
    return Promise.reject(error)
  }
)
*/
// 请根据实际需求修改
service.interceptors.response.use(response => {
  response.config.loading && tryHideLoading(store.getters.currentPath)
  checkAuth(response)
  return response.data
}, error => {
  error.response.config.loading && tryHideLoading(store.getters.currentPath)
  let msg
  if (error.response) {
    checkAuth(error.response)
    checkPermission(error.response)
    msg = error.response.data.message || error.response.data
  } else {
    msg = error.message
  }
  !error.config.hideMsg && $error(msg)
  return Promise.reject(error)
})
export default service
