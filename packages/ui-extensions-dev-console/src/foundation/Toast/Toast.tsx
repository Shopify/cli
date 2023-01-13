import * as styles from './Toast.module.scss'
import React from 'react'
import {ToastContainer} from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

export function Toast() {
  return (
    <div className={styles.Toast}>
      <ToastContainer
        position="bottom-center"
        theme="dark"
        closeButton={false}
        pauseOnFocusLoss={false}
        closeOnClick
        hideProgressBar
      />
      {/* react-toastify requires exactly this class. */}
      {/* Inlining the style prevents the className from changing */}
      <style>
        {`.Toastify__toast-body {
          padding: 0 16px;
          margin: 0;
        }`}
      </style>
    </div>
  )
}
