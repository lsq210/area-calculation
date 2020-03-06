const mapboxToken = 'pk.eyJ1IjoiY3N0YW8iLCJhIjoiY2p1eThkYjgzMHNvbzQ0cnhqd3c3OTU1biJ9.vT96vIXE74LTVV4xXrv0Zw';
const drawId = 'calculate-polygon';
// 经度整数部分为0~180，小数部分0~4；纬度整数部分为0~90，小数部分0~4
const lngPattern = /^[\-\+]?(((\d|[1-9]\d|1[1-7]\d|0)\.\d{0,4})|(\d|[1-9]\d|1[1-7]\d|0{1,3})|180\.0{0,4}|180)$/;
const latPattern = /^[\-\+]?([0-8]?\d{1}\.\d{0,4}|90\.0{0,4}|[0-8]?\d{1}|90)$/;

new Vue({
  el: '#app',
  data: {
    positions: [],
    unit: 0,
    mapList: [{
      value: 'mapbox://styles/mapbox/satellite-v9',
      label: 'mapbox://styles/mapbox/satellite-v9'
    },{
      value: 'mapbox://styles/mapbox/streets-v11',
      label: 'mapbox://styles/mapbox/streets-v11'
    }],
    mapStyle: 'mapbox://styles/mapbox/satellite-v9'
  },
  computed: {
    area: function () {
      if (this.rawArea){
        switch (this.unit) {
          case 0:
            return this.rawArea * 9101160000.085981;
          case 1:
            return this.rawArea * 9101160000.085981 * 0.0001;
          case 2:
            return this.rawArea * 9101160000.085981 * 0.0015;
          default:
            return null;
        }
      } else {
        return null;
      }
    }
  },
  mounted() {
    this.initMap();
    this.welcome();
  },
  watch: {
    positions: function () {
      this.mapOptions.draw.deleteAll();
      if (this.positions.length === 0) {
        return;
      } else if (this.positions.length === 1) {
        this.mapOptions.draw.add({ 
          id: drawId,
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [this.positions[0].lng, this.positions[0].lat] }
        })
      } else if (this.positions.length === 2) {
        this.mapOptions.draw.add({ 
          id: drawId,
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: this.positions.map(p => [p.lng, p.lat]) }
        }) 
      } else {
        this.mapOptions.draw.add({ 
          id: drawId,
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [
            [...this.positions.map(p => [p.lng, p.lat]), [this.positions[0].lng, this.positions[0].lat]]
          ] }
        })
      }
    },
    mapStyle: function () {
      this.mapOptions.map.setStyle(this.mapStyle)
    }
  },
  methods: {
    handleClose(tag) {
      this.rawArea = null;
      this.positions.splice(this.positions.indexOf(tag), 1);
    },
    showInput() {
      this.inputVisible = true;
      this.$nextTick(_ => {
        this.$refs.saveTagInput.$refs.input.focus();
      });
    },
    handleInputConfirm() {
      this.rawArea = null;
      let inputValue = this.inputValue;
      if(inputValue) {
        inputValue = inputValue.split(',');
        if(inputValue.length == 2 && lngPattern.test(inputValue[0]) && latPattern.test(inputValue[1])) {
          this.positions.push({
            lng: parseFloat(inputValue[0]),
            lat: parseFloat(inputValue[1]),
          });
          this.inputValue = '';
          this.inputVisible = false;
          if(this.positions.length === 1) {
            this.mapOptions.map.flyTo({
              center: [this.positions[0].lng, this.positions[0].lat]
            });
          } else {
            let bbox = this.positions.map(p => [p.lng, p.lat]);
            this.mapOptions.map.fitBounds(bbox, {
              padding: {top: 80, bottom:80, left: 50, right: 50}
            });
          }
        } else {
          this.showError('There is a problem with the position format!');
          return;
        }
      } else {
        this.inputVisible = false;
      }
    },
    showError(message) {
      this.$notify.error({
        title: 'ERROR',
        message,
      })
    },
    welcome() {
      this.$alert('你可以使用绘图工具来画一个多边形，也可以按顺时针或逆时针输入一组坐标，点击计算即可得到这个多边形的面积😋',
       '地理多边形面积计算');
    },
    calculate() {
      let xmldata = `
      <S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/" 
        xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
        <SOAP-ENV:Header/>
        <S:Body>
          <ns2:polygon_area xmlns:ns2="http://calculator.me.org/">
            <locations>${this.positions.map(p => p.lng + ',' + p.lat).join(' ')}</locations>
          </ns2:polygon_area>
        </S:Body>
      </S:Envelope>`;
      let matchReg = /(?<=<return>).*?(?=<\/return>)/;
      axios({
        method: 'post',
        url: '/CalculatorWS/CalculatorWS?wsdl',
        data: xmldata,
        headers: {'Content-Type': 'text/xml'}
      }).then(res => {
        this.rawArea =  res.data.match(matchReg)[0];
      }).catch(error => {
        this.$notify(error)
      });
    },
    initMap() {
      mapboxgl.accessToken = mapboxToken;
      this.mapOptions.map = new mapboxgl.Map({
        container: 'map', // container id
        style: 'mapbox://styles/mapbox/satellite-v9', //hosted style id
        center: [-91.874, 42.76], // starting position
        zoom: 12 // starting zoom
      });
      this.mapOptions.draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true
        }
      });
      this.mapOptions.map.addControl(this.mapOptions.draw);
      this.mapOptions.map.on('draw.update', this.updateArea)
      this.mapOptions.map.on('draw.create', this.updateArea);
      this.mapOptions.map.on('draw.delete', this.updateArea);
    },
    updateArea (e) {
      this.rawArea = null;
      var featureNum = this.mapOptions.draw.getAll().features.length;
      if (featureNum === 0) {
        this.positions = [];
      } else if (featureNum === 1) {
        // area = Math.round(turf.area(this.mapOptions.draw.getAll()) * 100) / 100;
        let temp = this.mapOptions.draw
        .getAll()
        .features[0]
        .geometry
        .coordinates[0]
        if (temp) {
          this.positions = temp.map(p => ({lng: p[0], lat: p[1]})).filter((_, i) => temp.length - 1 != i);
        } else {
          this.positions = [];
        }
      } else if (featureNum > 1) {
        this.$notify.warning({
          title: 'Warning',
          message: 'The number of features needs to be one, please delete the extra!'
        })
      }
    }
  },
})