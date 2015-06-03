#lang racket/base
;; Seashell.
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
(require seashell/seashell-config)
(require racket/cmdline racket/match)

(begin
  (define mode (make-parameter 'version))
  (command-line
    #:usage-help "Seashell multi-tool binary."
    #:once-each
    [("-l" "--login") "Run the login tool." (mode 'login)]
    [("-s" "--server") "Run the server." (mode 'server)]
    [("-d" "--dump") "Dumps existing credentials." (mode 'creds)]
    [("-v" "--version") "Prints version information. [default]" (mode 'version)])
  (match (mode)
         ['version (printf "Seashell ~a (~a-~a) (API version ~a) multi-tool binary.~n"
                           SEASHELL_VERSION SEASHELL_BRANCH SEASHELL_COMMIT SEASHELL_API_VERSION)
                   (printf "Executable path: ~a.~n" (path->string (find-executable-path (find-system-path 'exec-file))))
                   (printf "Build directory: ~a.~n" SEASHELL_BUILD_PATH)
                   (printf "Build type: ~a.~n" (if SEASHELL_DEBUG "Debug" "Release"))
                   (printf "Installation status: ~a.~n" (if SEASHELL_INSTALLED (format "Installed in ~a" SEASHELL_INSTALL_PATH) "Not installed"))]
         ['login ((dynamic-require 'seashell/login/login-gateway 'gateway-main))]
         ['server ((dynamic-require 'seashell/backend/server 'backend-main))]
         ['creds 
          (with-handlers
            ([exn:fail? (lambda (exn) (write #f))])
            (write ((dynamic-require 'seashell/backend/server 'dump-creds))))])
  (void))
