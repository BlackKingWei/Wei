let map;
let placesService;
let results = [];
let directionsRenderer;
let directionsService;
let currentDirections = null;
let currentMarker = null;
let currentInfoWindow = null;
let cityLocation = null;
let markers = [];
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 23.58, lng: 120.58 },
        zoom: 8,
        
    });
    placesService = new google.maps.places.PlacesService(map);
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);
    directionsService = new google.maps.DirectionsService();
    const trafficLayer = new google.maps.TrafficLayer(); // 创建交通层实例
    trafficLayer.setMap(map); // 将交通层添加到地图上
    google.maps.event.addListenerOnce(map, 'idle', function () {
        initializePlacesService();
    });
    
}
async function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
    });
}
document.getElementById('citySearch').addEventListener('input', async function(e) {
    var city = e.target.value;
    const food = document.getElementById('foodSearch').value||'';
    const sortOption = document.getElementById('sortOptions').value||'';
    const priceFilter = document.getElementById('priceFilter').value||'';
    console.log(city);
    resetLayout();
    console.log(city, food, sortOption, priceFilter);  // 打印所有变量以确保它们都已被正确获取
    map.setCenter(city);
    map.setZoom(14);
    if (city) {  // 确保 city 不为空
        clearMarkers();
        await getCoordinates(city, food, sortOption, priceFilter).then(location => {
            if (location) {
                map.setCenter(location);
                map.setZoom(14);
            }
        });
    } else {
        console.error("No city provided");
    }
});
document.getElementById('openNow').addEventListener('change', async function() {
    const city = document.getElementById('citySearch').value||'';
    const food = document.getElementById('foodSearch').value||'';
    const sortOption = document.getElementById('sortOptions').value;
    const priceOption = document.getElementById('priceFilter').value;
    await getCoordinates(city,food,sortOption,priceOption);
    await getfood(city, food, sortOption, priceOption);
});

document.getElementById('takeout').addEventListener('change', async function() {
    const city = document.getElementById('citySearch').value||'';
    const food = document.getElementById('foodSearch').value||'';
    const sortOption = document.getElementById('sortOptions').value;
    const priceOption = document.getElementById('priceFilter').value;
    await getCoordinates(city,food,sortOption,priceOption);
    await getfood(city, food, sortOption, priceOption);
});

document.getElementById('sortOptions').addEventListener('change', async function(e) {
    const sortOption = e.target.value;
    const food = document.getElementById('foodSearch').value||'';
    const city = document.getElementById('citySearch').value||'';
    await getCoordinates(city,food,sortOption,priceFilter);
    await getfood(city, food, sortOption,priceFilter);
});

document.getElementById('priceFilter').addEventListener('change', async function(e) {
    const priceFilter = e.target.value;
    const food = document.getElementById('foodSearch').value||'';
    const city = document.getElementById('citySearch').value||'';
    await getCoordinates(city,food,null,priceFilter);
    await getfood(city, food, null, priceFilter);
});

async function getCoordinates(city, food, sortOption, priceFilter) {
    try {
        const geocoder = new google.maps.Geocoder();
        const openNow = document.getElementById('openNow').checked;
        const takeout = document.getElementById('takeout').checked;
        const query = food.trim() !=='' ? food :'restaurant';
        let location = null;
        clearRestaurantList();
        console.log("Received in getCoordinates:", city, food, sortOption, priceFilter); // 确认值传递

        if (city === '目前位置') {
            const position = await getCurrentPosition();
            location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
        } else {
            const geocodeResult = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: city }, (results, status) => {
                    if (status === 'OK') {
                        resolve(results);
                    } else {
                        reject(status);
                    }
                });
                
            });
            if (geocodeResult && geocodeResult.length > 0) {
                location = {
                    lat: geocodeResult[0].geometry.location.lat(),
                    lng: geocodeResult[0].geometry.location.lng()
                };
                cityLocation = location;
                console.log("City location updated:", cityLocation);
            } else {
                console.error("Geocoding API error");
                return;
            }
        }

        
            const request = {
                location: new google.maps.LatLng(location.lat, location.lng),
                radius: '500',
                query: query,
                openNow: openNow,
                takeout: takeout
            };

       
            placesService.textSearch(request, function(results, status) {
            if (status !== google.maps.places.PlacesServiceStatus.OK) {
                console.error('Places API error:', status);
                return;
            }

            // 在结果处理前应用价格和其他过滤条件
            if (priceFilter) {
                results = filterByPrice(results, priceFilter);
            }
            if (sortOption) {
                results = sortResults(results, sortOption);
            }
            if (takeout) {
                results = results.filter(place => place.types.includes('meal_takeaway'));
            }

            const resultsDiv = document.getElementById('restaurantlist');
            resultsDiv.innerHTML = '';
            results.forEach(place => createRestaurantMarker(place, map, new google.maps.LatLngBounds()));
        });
        return location;
    } catch (error) {
        console.error("Error fetching coordinates: ", error);
    }
}


document.getElementById('foodSearch').addEventListener('input', async function(e) {
    var food = e.target.value;
    const sortOption = document.getElementById('sortOptions').value;
    const priceFilter = document.getElementById('priceFilter').value;
    const openNow = document.getElementById('openNow').checked;
    const takeout = document.getElementById('takeout').checked;
        resetLayout();

    // const city = document.getElementById('citySearch').value; // 確保 city 變數已定義

    clearRestaurantList();
    clearMarkers();
    if (food) {  // 确保 food 不为空
        if (cityLocation) {  // 如果选择了城市
            await getfood(cityLocation, food, sortOption, priceFilter, openNow, takeout);
        } else {  // 未选择城市，使用全台湾边界
            const taiwanBounds = {
                northeast: { lat: 25.3, lng: 122 },
                southwest: { lat: 21.8, lng: 119.5 }
            };
            await getfood(taiwanBounds, food, sortOption, priceFilter, openNow, takeout);
        }
    } else {
        console.error("No food provided");
    }
    if (cityLocation && isFinite(cityLocation.lat) && isFinite(cityLocation.lng)) {
        const mapOptions = {
            center: { lat: cityLocation.lat, lng: cityLocation.lng },
            zoom: 15
        };
        const map = new google.maps.Map(document.getElementById('map'), mapOptions);

        const request = {
            location: new google.maps.LatLng(cityLocation.lat, cityLocation.lng),
            radius: '500',
            query: food|| 'restaurant',
            openNow: openNow,
        };

        placesService.textSearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                if (priceFilter) {
                    results = filterByPrice(results, priceFilter);
                }
                if (sortOption) {
                    results = sortResults(results, sortOption);
                }
                if (takeout) {
                    results = results.filter(place => place.types.includes('meal_takeaway'));
                }
                const resultsDiv = document.getElementById('restaurantlist');
                resultsDiv.innerHTML = '';
                results.forEach(place => {
                    createRestaurantMarker(place, map, new google.maps.LatLngBounds());
                });
            } else {
                console.error('Places API error:', status);
            }
    })};
    
});



async function getfood(location, food, sortOption, priceFilter, openNow, takeout) {
    try {
        let request;
        const cityLocation = await getCoordinates(selectedCity);  // 獲取城市的座標
        if (cityLocation && isFinite(cityLocation.lat) && isFinite(cityLocation.lng)) {
                map.setCenter(cityLocation);  // 將地圖中心設置為城市座標
            } else {
            console.error('Invalid city location: ', cityLocation);
            }
        if (selectedCity) {  // 如果選擇了城市
            const cityLocation = await getCoordinates(selectedCity);  // 獲取城市的座標
            map.setCenter(cityLocation);
            map.setZoom(14);
            request = {
                location: new google.maps.LatLng(location.lat, location.lng),
                radius: '500',
                query: food,
                openNow: openNow,
            };
        } else if (location.northeast && location.southwest) {  // 如果是全台湾边界
            request = {
                bounds: new google.maps.LatLngBounds(
                    new google.maps.LatLng(location.southwest.lat, location.southwest.lng),
                    new google.maps.LatLng(location.northeast.lat, location.northeast.lng)
                ),
                query: food,
                openNow: openNow,
            };
        } 

        placesService.textSearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                if (priceFilter) {
                    results = filterByPrice(results, priceFilter);
                }
                if (sortOption) {
                    results = sortResults(results, sortOption);
                }
                if (takeout) {
                    results = results.filter(place => place.types.includes('meal_takeaway'));
                }
                const resultsDiv = document.getElementById('restaurantlist');
                resultsDiv.innerHTML = '';
                results.forEach(place => {
                    createRestaurantMarker(place, map, new google.maps.LatLngBounds());
                });
            } else {
                console.error('Places API error:', status);
            }
        });
    } catch (error) {
        console.error('Error fetching coordinates: ', error);
    }
}


function filterByPrice(results, priceFilter) {
    const priceRanges = {
        '0-150': [0, 150],
        '150-600': [150, 600],
        '600-1200': [600, 1200],
        '1200-': [1200, Infinity]
    };

    const [minPrice, maxPrice] = priceRanges[priceFilter] || [0, Infinity];

    return results.filter(place => {
        const priceLevel = place.price_level || 0; // 假設 price_level 屬性存在並且以數字形式存儲
        const averagePrice = priceLevel * 300; // 假設每個 price_level 大約對應 300 新台幣
        return averagePrice >= minPrice && averagePrice <= maxPrice;
    });
}

function sortResults(results, sortOption) {
    if (sortOption === 'latest') {
        return results.sort((a, b) => {
            return new Date(b.opening_date) - new Date(a.opening_date);
        });
    } else if (sortOption === 'rating') {
        return results.sort((a, b) => b.rating - a.rating);
    } else if (sortOption === 'popular') {
        return results.sort((a, b) => b.user_ratings_total - a.user_ratings_total);
    }
    return results;
}

function initializePlacesService() {
    if (!google.maps.places || !google.maps.places.PlacesService) {
        console.error('Error: Google Maps PlacesService is undefined.');
        return;
    }
    // 將 PlacesService 初始化並賦值給全局變數
    placesService = new google.maps.places.PlacesService(map);
}


function handleLocationError(browserHasGeolocation, pos) {
    console.error(
        browserHasGeolocation
            ? "Error: The Geolocation service failed."
            : "Error: Your browser doesn't support geolocation."
    );
    map.setCenter(pos);
}

window.initMap = initMap;

function searchNearbyRestaurants( lat, lng) {
    clearRestaurantList();
    var location = new google.maps.LatLng(lat, lng);
    var request = {
        location: location,
        radius: 500, // 半径（米），你可以根据需要调整
        type: ['restaurant'] // 类型，这里设置为餐厅
    };
    var bounds = new google.maps.LatLngBounds();
    placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            console.log('Results:', results);
            // 在地图上显示餐厅标记
            for (let i = 0; i < results.length; i++) {
                createRestaurantMarker(results[i],map, bounds);
            }
            map.fitBounds(bounds);
        }
        else {
            console.error('Nearby search failed with status:', status);
            }
    });
    console.log('Results:', results);
}
console.log(document.getElementById('priceFilter').value);  // 检查是否可以获取到值

function createRestaurantMarker(place, map, bounds) {
    const marker = new google.maps.Marker({
        map: map,
        position: place.geometry.location,
        title: place.name
    });
    markers.push(marker);  // 将标记添加到数组中

    bounds.extend(marker.getPosition());
    // 添加点击事件监听器到标记
    marker.addListener('click', function () {
        console.log('Clicked marker with place:', place);
        showInfoWindow(place, marker);
        calculateAndDisplayRoute(place);
        showRestaurantReviews(place.place_id, marker);
        displayRestaurantDetails(place); // 显示餐厅详细信息
    });
    // 将餐厅名称添加到列表中
    const restaurantList = document.getElementById("restaurantlist");
    const listItem = document.createElement("li");
    listItem.textContent = place.name;

    // 为列表项添加点击事件监听器
    listItem.addEventListener('click', function () {
        calculateAndDisplayRoute(place);
        showInfoWindow(place, marker);
        showRestaurantReviews(place.place_id,marker);
        displayRestaurantDetails(place); // 显示餐厅详细信息
    });

    restaurantList.appendChild(listItem);

    console.log("Added restaurant: " + place.name);
}

  // 新函数用于打开信息窗口并展示地点信息
function showInfoWindow(place, marker) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const origin = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                const destination = new google.maps.LatLng(place.geometry.location.lat(), place.geometry.location.lng());
    
                const directionsService = new google.maps.DirectionsService();
                const request = {
                    origin: origin,
                    destination: destination,
                    travelMode: 'DRIVING'
                };
    
                directionsService.route(request, (response, status) => {
                    if (status === 'OK') {
                        const duration = response.routes[0].legs[0].duration.text; // 获取预计通勤时间
                        let content = `<div><strong>${place.name}</strong></div>`;
    
                        // 添加餐廳的詳細信息
                        if (place.vicinity) {
                            content += `<div>地址: ${place.vicinity}</div>`;
                        }
                        if (place.rating) {
                            content += `<div>星級: ${place.rating}</div>`;
                        }
    
                        // 添加通勤時間
                        content += `<div>通勤時間: ${duration}</div>`;
    
                        if (currentInfoWindow) {
                            currentInfoWindow.close(); // 关闭当前信息窗口
                        }
    
                        const infowindow = new google.maps.InfoWindow({
                            content: content
                        });
                        infowindow.open(map, marker);
                        currentInfoWindow = infowindow; // 更新当前打开的信息窗口引用
                    } else {
                        console.error('Directions request failed due to ' + status);
                        // Even if directions fail, still show basic info
                        let content = `<div><strong>${place.name}</strong></div>`;
                        if (place.vicinity) {
                            content += `<div>地址: ${place.vicinity}</div>`;
                        }
                        if (place.rating) {
                            content += `<div>星級: ${place.rating}</div>`;
                        }
    
                        if (currentInfoWindow) {
                            currentInfoWindow.close();
                        }
    
                        const infowindow = new google.maps.InfoWindow({
                            content: content
                        });
                        infowindow.open(map, marker);
                        currentInfoWindow = infowindow;
                    }
                });
            }, () => {
                console.error("Geolocation failed.");
                // Show basic info even if geolocation fails
                let content = `<div><strong>${place.name}</strong></div>`;
                if (place.vicinity) {
                    content += `<div>地址: ${place.vicinity}</div>`;
                }
                if (place.rating) {
                    content += `<div>星級: ${place.rating}</div>`;
                }
    
                if (currentInfoWindow) {
                    currentInfoWindow.close();
                }
    
                const infowindow = new google.maps.InfoWindow({
                    content: content
                });
                infowindow.open(map, marker);
                currentInfoWindow = infowindow;
            });
        }
}
    

function calculateAndDisplayRoute(place) {
    directionsRenderer.setDirections({routes: []});

    const directionsService = new google.maps.DirectionsService();
    
    // 如果 directionsRenderer 不存在，則創建一個新的
    if (currentDirections) {
        currentDirections.setMap(null); // 清除旧的路线
    }

    // 使用當前用戶位置作為起點
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);

                const request = {
                    origin: userLocation,
                    destination: place.geometry.location, // 餐廳位置
                    travelMode: 'DRIVING' // 駕駛模式，可以根據需要更改
                };

                // 使用 Directions Service 規劃路線
                directionsService.route(request, function (response, status) {
                    if (status === 'OK') {
                        // 设置新的路线并显示在地图上
                        if (!currentDirections){
                            currentDirections = new google.maps.DirectionsRenderer();
                        }
                        currentDirections.setMap(map);
                        currentDirections.setDirections(response);
                    } else {
                        window.alert('Directions request failed due to ' + status);
                    }
                });
            },
            () => {
                handleLocationError(true, map.getCenter());
            }
        );
    } else {
        // 如果瀏覽器不支持地理位置，處理錯誤
        handleLocationError(false, map.getCenter());
    }
}




function showRestaurantReviews(placeId, marker) {
    if (!marker) {
        console.error("Marker is undefined");
        return;
    }
    if (!placeId) {
        console.error("No place ID provided");
        return;
    }

    const request = {
        placeId: placeId,
        fields: ['name', 'vicinity', 'rating', 'reviews','photos']
    };

    placesService.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            const reviewsContainer = document.getElementById("detailsContent");
            reviewsContainer.innerHTML = '';  // 清空之前的评论
            const reviews = place.reviews;
            let detailsElement = document.getElementById('detailsContent');
            detailsElement.innerHTML = `
            <h2>${place.name}</h2>
            <p>地址: ${place.vicinity}</p>
            <p>星級: ${place.rating}</p>
        `;
        

            for (let i = 0; i < Math.min(reviews.length, 3); i++) {
                const review = reviews[i];
                const reviewElement = document.createElement("div");
                reviewElement.innerHTML = `<strong>${review.author_name}</strong>: ${review.text}`;
                reviewsContainer.appendChild(reviewElement);
            }
            if (place.photos && place.photos.length > 0) {
                const photoUrl = place.photos[0].getUrl();  // 获取第一张照片的URL
                const img = document.createElement('img');  // 创建一个新的img元素
                img.src = photoUrl;  // 设置图片的src属性
                img.alt = `Photo of ${place.name}`;  // 设置图片的alt属性
                img.style.width = '50%';  // 设置图片宽度为100%
                // detailsElement += `<img src="${photoUrl}" alt="Photo of ${place.name}" style="width:100%;">`;
                detailsElement.appendChild(img);
                console.log(photoUrl);
                console.log(place.name);
            }
        } else {
            console.error('Failed to fetch reviews:', status);
            const reviewsContainer = document.getElementById("detailsContent");
            reviewsContainer.innerHTML = `Failed to load reviews: ${status}`;
        }
    });
}

function clearRestaurantList() {
    const resultsDiv = document.getElementById('restaurantlist');
    resultsDiv.innerHTML = '';
    const review = document.getElementById('detailsContent');
    review.innerHTML = '';
}
function clearMarkers() {
    for (let i = 0; i < markers.length; i++) {
        markers[i].setMap(null);
    }
    markers = [];
}
function displayRestaurantDetails(place) {
    const mapElement = document.getElementById('map');
    const detailsElement = document.getElementById('detailsContent');

    // 显示餐厅详细信息
    detailsElement.innerHTML = `
        <h2>${place.name}</h2>
        <p>地址: ${place.vicinity}</p>
        <p>星級: ${place.rating}</p>
    `;
    
    // 调整布局
    mapElement.classList.add('shrink');
    detailsElement.classList.add('expand');
    detailsElement.style.display = 'block';
}
function resetLayout() {
    const mapElement = document.getElementById('map');
    const detailsElement = document.getElementById('detailsContent');

    mapElement.classList.remove('shrink');
    detailsElement.classList.remove('expand');
    detailsElement.style.display = 'none';
}

function toggleRestaurantDetails() {
    var detailsSection = document.getElementById('restaurantDetails');
    if (detailsSection.style.display === 'none') {
        detailsSection.style.display = 'block';
    } else {
        detailsSection.style.display = 'none';
    }
}
function showRestaurantDetails() {
    const detailsElement = document.getElementById('detailsContent');
    const mapElement = document.getElementById('map');
    const listElement = document.getElementById('restaurantlist');

    // 調整顯示布局
    detailsElement.style.display = 'block';
    mapElement.classList.add('shrink');
    detailsElement.classList.add('expand');

    // 調整寬度
    mapElement.style.width = '40%';
    detailsElement.style.width = '30%';
    listElement.style.width = '30%';
}
// 在 function.js 中
window.addEventListener('load', () => {
    const hideButton = document.querySelector('#restaurantDetails button');
    hideButton.addEventListener('click', hideRestaurantDetails);
});

function hideRestaurantDetails() {
    const detailsElement = document.getElementById('detailsContent');
    const mapElement = document.getElementById('map');
    const listElement = document.getElementById('restaurantlist');

    // 隱藏詳細資訊區域並重設布局
    detailsElement.style.display = 'none';
    mapElement.style.width = '70%';
    listElement.style.width = '30%';
}

// 添加事件監聽，例如點擊餐廳名稱時調用showRestaurantDetails()
// 您可能需要在添加餐廳列表項目時動態綁定這些事件
