#!/bin/bash

# This project is free software and is licensed under the LGPL
# You should have received a copy of the GNU Lesser General Public License along with this program; if not, see <http://www.gnu.org/licenses/>.


DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

node $DIR/app.js $*
