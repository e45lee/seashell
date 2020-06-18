#lang typed/racket
;; Seashell's (native/OS dependant) support functions.
;; Copyright (C) 2013-2015 The Seashell Maintainers.
;;
;; This program is free software: you can redistribute it and/or modify
;; it under the terms of the GNU General Public License as published by
;; the Free Software Foundation, either version 3 of the License, or
;; (at your option) any later version.
;;
;; See also 'ADDITIONAL TERMS' at the end of the included LICENSE file.
;;
;; This program is distributed in the hope that it will be useful,
;; but WITHOUT ANY WARRANTY; without even the implied warranty of
;; MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
;; GNU General Public License for more details.
;;
;; You should have received a copy of the GNU General Public License
;; along with this program.  If not, see <http://www.gnu.org/licenses/>.
(module ffi racket/base
  (require ffi/unsafe
           ffi/unsafe/define)
  (require seashell/seashell-config)

  (provide seashell_drop_permissions
           seashell_create_secret_file
           seashell_uw_check_remote_user
           seashell_get_username
           seashell_set_umask
           seashell_signal_detach
           seashell_try_and_lock_file)

  (define-ffi-definer define-support
                      (ffi-lib (read-config 'seashell-support)))

  ;; These functions return 0 on success and 1 on failure if they return anything.
  ;; Manually check the result of these functions - as failure can indicate there's
  ;; an underlying security issue that needs to be addressed.
  (define-support seashell_drop_permissions (_fun -> _int))
  (define-support seashell_set_umask (_fun -> _void))
  (define-support seashell_signal_detach (_fun -> _int))
  (define-support seashell_create_secret_file (_fun _path -> _int))
  (define-support seashell_uw_check_remote_user (_fun -> _int))
  (define-support seashell_get_username (_fun -> _string))
  (define-support seashell_try_and_lock_file (_fun _int -> _int)))

(require/typed (submod "." ffi)
               [seashell_drop_permissions (-> Fixnum)]
               [seashell_set_umask (-> Void)]
               [seashell_signal_detach (-> Fixnum)]
               [seashell_create_secret_file (-> Path Fixnum)]
               [seashell_uw_check_remote_user (-> Fixnum)]
               [seashell_get_username (-> String)]
               [seashell_try_and_lock_file (-> Nonnegative-Fixnum Fixnum)])
(require/typed ffi/unsafe/port
               [unsafe-port->file-descriptor (-> Port (U #f Nonnegative-Fixnum))]) 

(provide seashell_drop_permissions
         seashell_create_secret_file
         seashell_uw_check_remote_user
         seashell_get_username
         seashell_set_umask
         seashell_signal_detach
         try-and-lock-file)

;; try-and-lock-file port? -> bool?
;; Attempts to lock the file @ port using fcntl, returning #f if it could not,
;; #t otherwise.
(: try-and-lock-file (-> Port Boolean))
(define (try-and-lock-file port)
  (define fd (unsafe-port->file-descriptor port))
  (cond
    [fd (= 0 (seashell_try_and_lock_file fd))]
    [else #f]))

