if(NOT TARGET ReactAndroid::hermestooling)
add_library(ReactAndroid::hermestooling SHARED IMPORTED)
set_target_properties(ReactAndroid::hermestooling PROPERTIES
    IMPORTED_LOCATION "/Users/enkyuan/.gradle/caches/8.14.3/transforms/80104bb6e704adcf5f2e0c7d97f0d5f7/transformed/react-android-0.81.4-debug/prefab/modules/hermestooling/libs/android.arm64-v8a/libhermestooling.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/enkyuan/.gradle/caches/8.14.3/transforms/80104bb6e704adcf5f2e0c7d97f0d5f7/transformed/react-android-0.81.4-debug/prefab/modules/hermestooling/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

if(NOT TARGET ReactAndroid::jsi)
add_library(ReactAndroid::jsi SHARED IMPORTED)
set_target_properties(ReactAndroid::jsi PROPERTIES
    IMPORTED_LOCATION "/Users/enkyuan/.gradle/caches/8.14.3/transforms/80104bb6e704adcf5f2e0c7d97f0d5f7/transformed/react-android-0.81.4-debug/prefab/modules/jsi/libs/android.arm64-v8a/libjsi.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/enkyuan/.gradle/caches/8.14.3/transforms/80104bb6e704adcf5f2e0c7d97f0d5f7/transformed/react-android-0.81.4-debug/prefab/modules/jsi/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

if(NOT TARGET ReactAndroid::reactnative)
add_library(ReactAndroid::reactnative SHARED IMPORTED)
set_target_properties(ReactAndroid::reactnative PROPERTIES
    IMPORTED_LOCATION "/Users/enkyuan/.gradle/caches/8.14.3/transforms/80104bb6e704adcf5f2e0c7d97f0d5f7/transformed/react-android-0.81.4-debug/prefab/modules/reactnative/libs/android.arm64-v8a/libreactnative.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/enkyuan/.gradle/caches/8.14.3/transforms/80104bb6e704adcf5f2e0c7d97f0d5f7/transformed/react-android-0.81.4-debug/prefab/modules/reactnative/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

