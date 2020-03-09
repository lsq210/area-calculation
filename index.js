const mapboxToken = 'pk.eyJ1IjoiY3N0YW8iLCJhIjoiY2p1eThkYjgzMHNvbzQ0cnhqd3c3OTU1biJ9.vT96vIXE74LTVV4xXrv0Zw';
const drawId = 'calculate-polygon';
// 经度整数部分为0~180，小数位数任意；纬度整数部分为0~90，小数位数任意
const lngPattern = /^[\-\+]?(((\d|[1-9]\d|1[1-7]\d)\.\d+)|(\d|[1-9]\d|1[1-7]\d)|180\.\0+|180)$/;
const latPattern = /^[\-\+]?([0-8]?\d{1}\.\d+|90\.0+|[0-8]?\d{1}|90)$/;

new Vue({
  el: '#app',
  data: {
    positions: [],
    rawArea: null,
    inputVisible: false,
    inputValue: '',
    loading: false,
    mapOptions: {
      map: null,
      draw: null
    },
    unitList: [{
      value: 0,
      label: 'm² (平方米)'
    },{
      value: 1,
      label: 'ha (公顷)'
    },{
      value: 2,
      label: 'mu (亩)'
    }],
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
            return this.rawArea;
          case 1:
            return this.rawArea * 0.0001;
          case 2:
            return this.rawArea * 0.0015;
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
        });
        this.rawArea = Math.round(turf.area(this.mapOptions.draw.getAll()) * 100) / 100;
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
      // this.rawArea = null;
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
            let line = turf.lineString(this.positions.map(p => [p.lng, p.lat]));
            let bbox = turf.bbox(line)
            this.mapOptions.map.fitBounds(bbox, {
              padding: {top: 100, bottom:100, left: 50, right: 50}
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
        if(this.mapOptions.draw.getAll().features.length) {
          let geometry = this.mapOptions.draw.getAll().features[0].geometry
          switch(geometry.type) {
            case 'Point':
              this.positions = [{lng: geometry.coordinates[0], lat: geometry.coordinates[1]}];
              break;
            case 'LineString':
              this.positions = geometry.coordinates.map(p => ({lng: p[0], lat: p[1]}));
              break;
            case 'Polygon':
              if(geometry.coordinates.length) {
                let temp = geometry.coordinates[0];
                this.positions = temp.map(p => ({lng: p[0], lat: p[1]})).filter((_, i) => temp.length - 1 != i);
              } else {
                this.positions = [];
              }
              break;
            default:
              break;
          }
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