if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/enkyuan/.gradle/caches/8.14.3/transforms/7c804b23ffe8a5dff3d0d918fb3d387b/transformed/hermes-android-0.81.4-debug/prefab/modules/libhermes/libs/android.arm64-v8a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/enkyuan/.gradle/caches/8.14.3/transforms/7c804b23ffe8a5dff3d0d918fb3d387b/transformed/hermes-android-0.81.4-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

